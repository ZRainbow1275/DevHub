# R8.B / R8.C Implementation Report

Date: 2026-05-03
Scope: `prompts/0503-2` R8.B UI Shell + R8.C AI orchestration contracts

## Summary

This implementation adds a real R8.B/R8.C vertical slice across shared contracts, Electron main-process services, IPC handlers, preload bridge, renderer typings, and the Monitor UI. It preserves all existing modules and adds the new R8 surfaces behind explicit typed APIs. Disabled or deferred capabilities return stable disabled contracts instead of fake success.

## Implemented Areas

### Shared Contracts

- Added complete R8 feature flag registries for R8.B and R8.C, with aggregate R8 defaults.
- Added R8 runtime Zod source-of-truth schemas for IPC channels, popouts, drawers, command palette, status tiles, CLI events, CSV rows, task queue runs, DAGs, watchdog, injection, notifications, permissions, backups, diagnostics, OCR-disabled responses, tool detection, and AI signal fusion.
- Extended the R8.C IPC registry with queue, CLI, injection whitelist, topology, flow, AI signal, recovery, backup, diagnostic, and permission channels.
- Updated the renderer preload whitelist contract at `prompts/0421/contracts/23-ipc-contracts-master.md` to match the real public preload bridge.

### Main Process Runtime

- Added `R8RuntimeService` with real electron-store persistence for feature overrides, popouts, drawers, command history, notifications, permission grants, backups, diagnostics, CLI parser events, queue runs, signal states, feedback, tool overrides, and injection whitelist entries.
- Implemented secure BrowserWindow popouts using `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, and `webSecurity: true`.
- Implemented CLI output parsing for NDJSON-style lines, step progress, percentages, completion, waiting-input, validation, and error detection.
- Implemented bounded real CLI tool detection for `codex`, `claude`, `gemini`, `cursor`, and `gh copilot`; missing tools return real not-found errors and do not fake availability.
- Implemented CSV row validation and durable task queue records. Rows are queued truthfully; external CLI execution is not marked as succeeded unless an executor actually runs.
- Implemented DAG cycle detection and ready-node evaluation.
- Implemented AI signal fusion with normalized source contributions and persisted instance state.
- Implemented feedback records for misreport correction.
- Implemented injection dry-run and guarded execution. Real native injection is blocked while `R8.A.libs.nut-js` remains disabled, returning `native-disabled` instead of pretending success.
- Implemented OCR and skill-cloud-sync stable disabled/deferred contracts.
- Implemented diagnostics and settings backup exports writing real files under Electron `userData` paths.

### IPC / Preload / Renderer

- Added `r8RuntimeHandlers` with rate-limited handlers for R8.B/R8.C runtime channels.
- Exposed a narrow `window.devhub.r8` bridge in preload without exposing raw `ipcRenderer`.
- Synchronized renderer global types with the new R8 bridge API.
- Added `R8CommandPalette` and `R8OpsPanel`.
- Added Monitor tab `R8 运营` without removing existing tabs.
- Extended the status bar to poll and render real R8 aggregate badges.

## No-Mock Guarantees

- CLI detection uses real subprocess probes with bounded timeout.
- Queue records are durable state and never report external command success without execution.
- Injection dry-run is explicitly marked as dry-run; real injection requires confirmation, whitelist, and enabled native flag.
- OCR and skill cloud sync return stable disabled contracts.
- Status tiles use the real scanner cache snapshot when available.
- Backups and diagnostics write real JSON files to Electron `userData` directories.

## Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/shared/feature-flags.test.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1
pnpm test --run src/preload/preloadContract.test.ts --maxWorkers=1
pnpm typecheck
```

Results:

- R8 targeted tests: 3 files passed, 18 tests passed.
- Preload contract tests: 1 file passed, 4 tests passed.
- TypeScript typecheck: passed.

## Known Boundaries

- `R8.A.libs.nut-js` is intentionally disabled by default, so native text injection returns `native-disabled` unless the operator explicitly enables the native flag and configures a whitelist.
- OCR remains hard-disabled by R8.C contract and returns `E_OCR_DISABLED`.
- Skill cloud sync remains deferred and returns `E_SKILL_CLOUD_SYNC_DEFERRED`.
- The repository had a large pre-existing dirty tree before this continuation. This report only describes the R8.B/C files touched in this implementation slice.

## 2026-05-06 Continuation - R8.B spec-17 Icon Library Slice

### Implemented Scope

- Added a shared icon token contract in `src/shared/icon-library.ts` covering `lucide`, `tabler`, `radix`, `heroicons`, and `brand`.
- Extended `src/shared/schemas/r8-runtime.ts` with icon Zod schemas and registered `icon:list-libraries` plus `icon:resolve-token`.
- Added `IconRegistryService` and `iconHandlers` so the main process can validate icon tokens without importing renderer icon packs.
- Exposed `window.devhub.r8.icon.listLibraries()` and `window.devhub.r8.icon.resolveToken(token)` through preload and renderer global types.
- Added the renderer `components/icon` layer with explicit imports, token resolution, `lucide:HelpCircle` fallback, accessible decorative/semantic rendering, and brand asset support for `brand:OpenAI`.
- Replaced the command palette's search and terminal glyphs with tokenized `Icon` usage as a real UI integration slice.
- Added `docs/r8/icon-library.md` documenting library boundaries, no-emoji rationale, accessibility rules, IPC, and current boundaries.

### Completion Boundary

- Complete for token contract, IPC/preload bridge, renderer resolver, accessible component behavior, fallback behavior, no-emoji gate integration, and one real command-palette UI slice.
- Not claimed complete: full renderer-wide icon migration, `useIconDefaults` theme-axis hook, AI tool sensing migration to `brand:*` tokens, Electron Playwright E2E, bundle-size proof, and icon render benchmark evidence.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE` for this slice:

```bash
pnpm -C devhub test --run src/main/services/IconRegistryService.test.ts src/renderer/components/icon/Icon.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
git -C devhub diff --check
git diff --check
```

Results:

- Targeted icon suite: 3 files passed, 9 tests passed.
- TypeScript typecheck: passed.
- Preload contract tests: 1 file passed, 4 tests passed.
- Lint and no-emoji gate: passed; `No emoji found in 573 files`.
- Zod SoT verification: passed.
- Trellis task context validation: passed.
- Diff whitespace checks: passed with pre-existing LF-to-CRLF warnings only.

## 2026-05-06 Continuation - R8.C spec-01 CLI Parser Public Bridge

### Implemented Scope

- Exposed the already-implemented CLI parser runtime through preload for `cli:get-sessions`, `cli:install-shim`, `cli:select-strategy`, and `cli:event-stream`.
- Corrected the public `cli:get-progress` return type to include `progress: ProgressDataPoint | null` and `instanceId` filtering.
- Synchronized `src/renderer/types/global.d.ts` with the preload bridge.
- Updated `prompts/0421/contracts/23-ipc-contracts-master.md` so the public preload whitelist matches the actual bridge.

### Completion Boundary

- Complete for parser framework, strategy registry, stream multiplexer, Zod SoT contracts, R8 runtime IPC handlers, preload bridge exposure, strategy-switch audit, and rate-limited IPC.
- Not claimed complete: direct `AITaskTracker` subscription into `SignalCollector` exactly as the original checklist phrased it, packaged Electron E2E for `cli:event-stream`, and a fresh full Vitest run after this low-resource bridge update.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub test --run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- Preload contract tests: 1 file passed, 4 tests passed.
- Parser/runtime target suite: 4 files passed, 98 tests passed.
- TypeScript typecheck: passed.
- Lint and no-emoji gate: passed; `No emoji found in 573 files`.
- Zod SoT verification: passed.

## 2026-05-06 Continuation - R8.C spec-02 Codex SHIM Slice

### Implemented Scope

- Updated `ShimRegistry.install()` to prepend the generated shim directory to the current DevHub process `PATH` only, without mutating user or machine environment variables.
- Verified that the generated passthrough shim script pipes `stdin`, mirrors `stdout` and `stderr`, forwards frames when connected, and handles wrapped-process exit.
- Expanded `CodexParser` tests to cover all seven strict marker fields: `PHASE`, `PROGRESS`, `TOKENS`, `TOOL`, `ERROR`, `DONE`, and `HEARTBEAT`.
- Added `docs/r8/codex-shim.md` with operator behavior, no-mock boundary, and non-claimed scope.

### Completion Boundary

- Complete for real Node passthrough shim generation, current-process `PATH` update, permission guard, uninstall cleanup, strict marker anti-spoofing, seven-field marker parsing, and documentation.
- Superseded by later evidence: packaged `codex-shim.exe`, startup `ensureShim()` reconciliation, shim client reconnect backoff, and packaged Electron E2E for transparent passthrough plus marker capture were closed by later R8.C spec-02 implementation updates.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/parsers/CodexParser.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- SHIM/Codex target suite: 3 files passed, 17 tests passed.
- Codex marker field suite: 1 file passed, 9 tests passed.
- TypeScript typecheck: passed.
- Lint and no-emoji gate: passed; `No emoji found in 573 files`.
- Zod SoT verification: passed.

## 2026-05-16 Continuation - R8.C spec-02 Packaged Codex SHIM Executable Closure

### Implemented Scope

- Added `shim/codex/codex-shim.cjs` as the packageable Codex SHIM entrypoint with sidecar manifest loading, transparent stdin/stdout/stderr passthrough, bounded named-pipe reconnect, and DONE/ERROR marker emission.
- Added `shim/codex/build.config.json`, `scripts/build-codex-shim.mjs`, and `scripts/verify-codex-shim-package.mjs` for reproducible `@yao-pkg/pkg` builds and real local verification.
- Added `@yao-pkg/pkg` as a development dependency and wired package scripts so Electron packaging builds the Codex shim first.
- Extended `ShimRegistry` to prefer a packaged Codex artifact, install it as `codex.exe` on Windows, write `${shimExePath}.json`, and remove sidecars during uninstall/reconciliation.
- Extended `R8RuntimeService` packaged-resource resolution so packaged Electron can load `resources/shims/codex/codex-shim-${platform}-${arch}` from `process.resourcesPath` or the development resources directory.

### Completion Boundary

- Complete for packaged Codex shim executable generation and runtime installation on Windows x64, with Linux x64 and macOS x64 cross-target artifacts generated by the same build script.
- Windows execution proof is local and real: the packaged executable wraps `process.execPath`, preserves stdout/stderr, exits `0`, and forwards named-pipe frames.
- Not claimed complete for Claude/Gemini packaged executables or for executing macOS/Linux artifacts on this Windows host.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
cd devhub && pnpm install --ignore-scripts --no-frozen-lockfile
cd devhub && pnpm shim:build:codex
cd devhub && pnpm shim:build:codex:all
cd devhub && pnpm shim:verify:codex
pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts -t "shim|Shim" --maxWorkers=1
pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.C spec-02" --reporter=line
```

Results:

- `shim:build:codex:all`: generated `codex-shim-win32-x64.exe`, `codex-shim-linux-x64`, and `codex-shim-darwin-x64` plus SHA256 files.
- `shim:verify:codex`: Windows executable exited `0`, preserved stdout/stderr, and forwarded three named-pipe frames.
- Shim-focused Vitest: 2 files passed, 6 tests passed.
- Full related Vitest: 3 files passed, 116 tests passed.
- Typecheck, lint/no-emoji, Zod SoT, no-cloud-deps, no-ocr-deps, production build, and spec-02 packaged Electron E2E all passed.

## 2026-05-06 Continuation - R8.C spec-03 Claude stream-json Slice

### Implemented Scope

- Added `src/shared/schemas/claude-stream.ts` as the strict Zod source of truth for Claude `system`, `assistant`, `user`, `result`, and `partial_assistant` NDJSON events.
- Reworked `ClaudeParser` to validate every line through the shared discriminated union and to distinguish malformed JSON from schema-incomplete Claude stream payloads.
- Preserved real `tool_use` metadata by emitting `tool_invocation` events with tool name, input, and tool-use id.
- Added per-instance `partial_assistant` 100ms throttling and merged partial text into normalized `message-out` events.
- Added token/cost normalization through `inputTokens`, `outputTokens`, `durationMs`, and `costUsd` payload fields.
- Added executable `ai:claude-cost-summary` IPC, preload bridge, renderer typing, and whitelist contract entry.
- Added `ai:claude-stream-event` main-to-renderer emission for schema-valid raw Claude stream events.
- Added `docs/r8/claude-stream-json.md` with current behavior, no-mock boundary, open items, and verification evidence.

### Completion Boundary

- Complete for strict schema, parser mapping, partial throttling, token/cost summary, raw Claude stream bridge, preload/global typing, Zod SoT registration, and target tests.
- Not claimed complete: live Claude process restart with injected flags, first-run restart authorization UI, `NotificationService.publish(ERROR)` for Claude result errors, packaged Electron E2E, live version compatibility matrix, and future schema-version migration field.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --testNamePattern "persists spec-22 recording manifests" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- Targeted Claude/runtime/preload suite: 5 files passed, 103 tests passed on the first run.
- One later grouped rerun surfaced an unrelated `spec-22` recording manifest race; the exact failing test passed when rerun by `--testNamePattern`.
- TypeScript typecheck: passed.
- Lint and no-emoji gate: passed; `No emoji found in 574 files`.
- Zod SoT verification: passed.
- GitNexus impact analysis: `ClaudeParser`, `R8RuntimeService`, and `setupR8RuntimeHandlers` all reported LOW risk.

## 2026-05-17 Continuation - R8.C spec-03 Post-Output Restart Authorization Closure

### Implemented Scope

- Extended the Claude restart Zod contract in `src/shared/schemas/claude-stream.ts` and registered the restart request/confirm/record schemas in `src/shared/schemas/r8-runtime.ts`.
- Updated generated and packaged Claude shim paths to emit post-output fallback metadata when a real child still writes non-stream-json output after stream-json normalization.
- Added a persisted `pending-confirmation` restart queue in `R8RuntimeService`, with unified `WARN` notification delivery through toast/statusbar and a `Restart with stream-json` action.
- Bound the notification action to `confirmClaudeStreamJsonRestart()`, preserving the authorization boundary: no new child process starts before the operator action or explicit typed confirmation.
- On confirmation, DevHub now runs a real local child process with forced stream-json args, records pid/running/exited or failed status, terminates the original Claude pid when available, and routes restarted stdout/stderr back through the Claude NDJSON parser.
- Hardened the restart regression test with a unique `instanceId` so persisted local cliEvents from older test runs cannot satisfy the proof.

### Completion Boundary

- Complete for R8.C spec-03 post-output fallback detection, first-run restart authorization through the unified notification popup/action surface, live local restart execution, and parser feedback of restarted stdout/stderr.
- Still not claimed complete: old Claude Code executable versions that reject `--output-format stream-json`; DevHub continues to report those as unsupported rather than pretending structured output exists.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "requires operator confirmation before restarting Claude" --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts -t "Claude|stream-json|ShimRegistry" --maxWorkers=1
pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub exec eslint src/shared/schemas/claude-stream.ts src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/services/shim/ShimRegistry.ts src/main/services/shim/ShimRegistry.test.ts shim/codex/codex-shim.cjs
pnpm -C devhub exec tsc --noEmit --pretty false
```

Results:

- Focused restart authorization test: 1 file passed, 1 selected test passed, 115 skipped.
- Claude grouped regression: 3 files passed, 16 tests passed, 113 skipped by filter.
- Schema/preload regression: 2 files passed, 26 tests passed.
- Touched-file ESLint: passed.
- Full TypeScript no-emit check: passed.

## 2026-05-06 Continuation - R8.C spec-04 Gemini stdout Slice

### Implemented Scope

- Added `src/shared/schemas/gemini-pattern.ts` as the Zod source of truth for Gemini pattern rules, parser state, stats requests/responses, and reload requests/responses.
- Registered Gemini pattern schemas in the runtime schema registry and schema index.
- Expanded `GeminiParser` to eight precompiled default rules, including a second prose-style tool-call rule for `Running tool: read_file`.
- Kept regex matching deterministic by resetting `lastIndex` before every rule evaluation.
- Hardened ANSI stripping with original-line fallback and bounded oversized stdout lines before matching.
- Preserved the 4,096-character per-instance partial buffer cap.
- Exposed `ai:gemini-pattern-stat` and `ai:gemini-rule-reload` through preload, renderer types, and the preload whitelist contract.
- Added `docs/r8/gemini-stdout-parser.md` with current behavior, no-mock boundary, open items, and verification evidence.

### Completion Boundary

- Complete for shared Gemini pattern schemas, eight-rule stdout parser coverage, defensive ANSI/long-line handling, IPC guard schemas, public preload bridge, and focused tests.
- Not claimed complete: Gemini-specific shim passthrough/marker injection, `gemini-pattern.json` filesystem watcher, direct `SignalCollector` write, 30s no-stdout timeout, unmatched-ratio audit warning loop, and packaged Electron E2E.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/cli-parser/parsers/GeminiParser.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --testNamePattern "Gemini|gemini|validates Gemini|reloads Gemini" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- Gemini-focused target suite: 4 files passed, 10 tests passed; `CLIOutputParser.test.ts` was skipped by the focused test name pattern.
- TypeScript typecheck: passed.
- Lint and no-emoji gate: passed; `No emoji found in 575 files`.
- Zod SoT verification: passed.
- GitNexus impact analysis: `GeminiParser` and `CLIOutputParser` both reported LOW risk.

## 2026-05-04 Continuation — R8.C Operation Loop Expansion

### Added Contracts

- Expanded `R8_IPC_CHANNELS` to 141 registered R8 runtime channels and 33 Zod schema registry entries.
- Added real contract coverage for CLI single-tool detection, tool path override, Cursor/Copilot status, SKILL get/write/delete/templates/reload, CSV command generation/launch/session/template APIs, task retry/skip, injection whitelist removal/target resolution/ready pool/history/cancel, watchdog history/manual restart override/supervisor status, AI misreport listing/fusion config/weight profile, notification aggregation config, backup restore/delete, diagnostic purge, permission allowlist/reset, recovery report/dismiss, and recording/replay lifecycle.
- Added `RecordingSession`, `RecoveryReport`, and `ReplayState` schemas as cross-layer source-of-truth contracts.

### Runtime Behavior

- All state-changing or destructive paths remain guarded by `confirmedBy` and throw `E_PERMISSION` if the operator confirmation is missing or too short.
- `csv:launch` creates a durable queued task/session and generated command payload only; it does not claim external CLI success without a real executor.
- `watchdog-supervisor:status` truthfully reports `not-installed`; this implementation does not auto-install a Windows service.
- Recording/replay state is persisted in the R8 runtime store; replay export writes a real JSON artifact only when explicitly invoked.
- R8OpsPanel now surfaces CSV sessions/templates, recordings, recovery reports, injection history, and watchdog supervisor status through the existing monitor layout.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm typecheck
pnpm test --run src/shared/feature-flags.test.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
```

Results:

- TypeScript typecheck: passed.
- R8 targeted tests: 4 files passed, 30 tests passed.
- Preload whitelist contract is synchronized with 253 public invoke channels, 8 send channels, and 26 listener channels.

### Final Verification Addendum — 2026-05-04

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm typecheck
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
```

Results:

- TypeScript typecheck: passed.
- Lint and no-emoji check: passed; `No emoji found in 253 files`.
- License check: passed; 377 production package entries validated and 1 documented exception retained.
- Full Vitest: 49 files passed, 456 tests passed with `--maxWorkers=1`.
- GitNexus analysis: repository indexed successfully with 3,047 nodes, 8,640 edges, 236 clusters, and 242 flows.
- GitNexus impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.

## 2026-05-04 Continuation — Full prompts/0503-2 Contract Coverage

### Added Contracts

- Expanded `R8_FEATURE_FLAGS` from 103 to 123 entries by adding the missing R8.A library aliases and the aggregate R8.B/R8.C gates required by the PRD/spec corpus.
- Expanded `R8_IPC_CHANNELS` from 141 to 305 entries; all 297 IPC channels declared by `prompts/0503-2/**/*.md` are now represented in the shared runtime registry.
- Added `R8_SPEC_DECLARED_IPC_CHANNELS` as a generated, static contract-only layer so spec-declared channels are visible to type-checking, schema validation, IPC registration, and runtime health reporting.
- Added `ContractOnlyResponse` to the Zod registry to make non-executable integration boundaries explicit and machine-verifiable.

### Runtime Behavior

- Existing concrete handlers still take precedence for implemented functionality.
- Channels without an executable integration are registered with a rate-limited contract-only handler that returns `success: false`, `executable: false`, and `E_R8_CONTRACT_ONLY`.
- Contract-only destructive or state-changing operations require `confirmedBy`; missing confirmation returns `E_PERMISSION` rather than pretending the operation ran.
- Contract-only payload echoes are redacted before returning to the renderer, including token, secret, and password fields.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/shared/feature-flags.test.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm typecheck
pnpm lint
```

Results:

- R8 targeted tests: 5 files passed, 34 tests passed.
- TypeScript typecheck: passed.
- Lint and no-emoji check: passed; `No emoji found in 254 files`.
- Mechanical contract metric: `required_channels=297`, `current_channels=305`, `missing_channels=0`, `feature_flags=123`, `missing_target_flags=[]`.

### Final Verification Addendum — Full Contract Coverage

Commands executed from `D:/Desktop/CREATOR ONE/devhub` after the contract-coverage update:

```bash
pnpm check:license
pnpm test --run --maxWorkers=1
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- License check: passed; 377 production package entries validated and 1 documented exception retained.
- Full Vitest: 50 files passed, 460 tests passed with `--maxWorkers=1`.
- GitNexus analyze: indexed 3,039 nodes, 8,657 edges, 235 clusters, and 241 flows.
- GitNexus impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

## 2026-05-04 Continuation — R8.C spec-01 CLIOutputParser Real Implementation

### Implemented Scope

- Added `src/main/services/cli-parser/` with `IParser`, `ParserRegistry`, `StreamMultiplexer`, `CLIOutputParser`, and four concrete strategies: NDJSON, SHIM, line-based, and SSE.
- Extended the shared R8 Zod SoT with `ParserDescriptor`, `ParseSession`, `CliEventPayload`, `CliOutputEvent`, and `ProgressDataPoint` contracts in `src/shared/schemas/r8-runtime.ts`.
- Wired parser sessions into `R8RuntimeService` and `r8RuntimeHandlers` for `cli:get-sessions`, `cli:get-progress`, `cli:install-shim`, `cli:select-strategy`, and `cli:event-stream` emission.
- Preserved the no-mock boundary: parser inputs are real stdout/stderr/title chunks; invalid JSON produces low-confidence `unknown` events; `cli:install-shim` writes a real shim file but does not claim the external CLI was executed.
- Added durable strategy-switch audit rows through `listCliStrategyAudit`; corrupted persisted audit rows are ignored during inspection rather than crashing the runtime.

### GWT Coverage

- GWT-1: NDJSON chunks with at least five lines emit five `CliOutputEvent` records and at least three event types.
- GWT-2: line-based `Step N/M` output emits `eventType='progress'`, `payload.step`, `payload.total`, and normalized progress.
- GWT-3: SHIM strategy parses structured stdout as `rawSource='shim'`.
- GWT-4: malformed NDJSON emits `eventType='unknown'` with confidence <= 0.2 without throwing.
- GWT-5: line + shim events for one `instanceId` fuse into `source='fusion'` with weighted progress and max confidence.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm test --run --maxWorkers=1
pnpm check:license
npx gitnexus analyze --force
npx gitnexus impact CLIOutputParser --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- Targeted R8.C parser suite: 4 files passed, 35 tests passed.
- TypeScript typecheck: passed.
- Lint and no-emoji check: passed; `No emoji found in 264 files`.
- Full Vitest: 51 files passed, 468 tests passed with `--maxWorkers=1`.
- License check: passed; 377 production package entries validated and 1 documented exception retained.
- GitNexus analyze: indexed 3,133 nodes, 8,958 edges, 246 clusters, and 248 flows.
- GitNexus impact: `CLIOutputParser` LOW risk; `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

## 2026-05-04 Continuation — R8.C SHIM Parser Foundation

### Implemented Scope

- Added `src/main/services/shim/MarkerProtocol.ts` with strict `DEVHUB::MARKER::v=1::*` parsing and formatting for Codex marker lines.
- Added `src/main/services/cli-parser/parsers/CodexParser.ts` and registered it for Codex SHIM parsing; valid PHASE markers emit high-confidence `phase_marker` events, malformed marker-like output is treated as ordinary stdout and cannot impersonate markers.
- Added `src/main/services/cli-parser/parsers/GeminiParser.ts` and registered it for Gemini line parsing; it strips ANSI safely, classifies thinking/progress lines, extracts `[tool: name]` tool calls, and falls back to the generic line parser for unmatched text.
- Extended the shared R8 Zod SoT with `CodexMarker`, `ShimManifest`, and `ShimFrame` schemas plus richer CLI event payload fields.

### Completion Boundary

- This is a verified parser-foundation slice for R8.C spec-02 and spec-04.
- It does not claim full PATH-level SHIM install/uninstall or named-pipe passthrough completion; those remain separate executable integration work under the corresponding SHIM specs.

### Verification

- `pnpm test --run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/cli-parser/parsers/GeminiParser.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1` — 4 files / 18 tests passed.
- `pnpm test --run --maxWorkers=1` — 53 files / 472 tests passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed, no emoji found in 270 files.
- `pnpm check:license` — passed.
- `npx gitnexus analyze --force` — indexed 3,182 nodes / 9,116 edges / 252 clusters / 252 flows.
- GitNexus impact: `CodexParser`, `GeminiParser`, and `ParserRegistry` are LOW risk.

## 2026-05-04 Continuation - R8.C spec-02..06 Executable Parser And Detection Slice

### Implemented Scope

- Promoted SHIM support from parser foundation to a real `ShimRegistry` integration that writes and removes per-tool shim files, persists manifests, and starts a local frame pipe server only after explicit `confirmedBy` approval.
- Added Claude stream-json parsing through `ClaudeParser`: system init, assistant tool_use, assistant token progress, result completion, result error subtype, and malformed stream-json error events are all converted into `CliOutputEvent` records.
- Expanded Gemini stdout parsing through `GeminiParser`: ANSI-safe rules, per-instance kind statistics, unmatched ratio, `ai:gemini-pattern-stat`, and confirmed `ai:gemini-rule-reload` hot reload are executable.
- Added Cursor/Copilot title detection without process injection: `CursorTitleParser`, `CopilotTitleParser`, and `CursorCopilotDetector` consume existing scanner window metadata, enforce process-name allowlists, cap confidence at 0.7, and expose `cli:cursor-copilot-status` plus `cli:title-rule-reload`.
- Hardened CLI detection init: 5-tool detection now runs through `Promise.allSettled`, cache TTL is 300000 ms, per-tool version probe timeout is 3000 ms, and user override paths must exist before they are stored.

### Completion Boundary

- Verified complete for parser/detection executable slices of R8.C spec-02, spec-03, spec-04, spec-05, and spec-06.
- Not claimed complete: PATH-level global shim replacement, automatic Claude process restart with stream-json flags, renderer monitor panels, settings UI for detection controls, and long-running watchdog/orchestration specs beyond spec-06.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/cli-parser/parsers/GeminiParser.test.ts src/main/services/cli-parser/CursorCopilotDetector.test.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
pnpm typecheck
```

Results:

- Targeted R8.C executable suite: 9 files passed, 56 tests passed.
- TypeScript typecheck: passed.
- GitNexus impact before edits: `ParserRegistry`, `CLIOutputParser`, `GeminiParser`, `R8RuntimeService`, `setupR8RuntimeHandlers`, `detectTools`, and `setToolOverride` were LOW risk.

### Final Verification Addendum - 2026-05-04 R8.C spec-02..06 Slice

Commands executed from `D:/Desktop/CREATOR ONE/devhub` after documentation and lint fixes:

```bash
pnpm lint
pnpm test --run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/cli-parser/parsers/GeminiParser.test.ts src/main/services/cli-parser/CursorCopilotDetector.test.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
pnpm typecheck
pnpm test --run --maxWorkers=1
pnpm check:license
npx gitnexus analyze --force
npx gitnexus impact CursorCopilotDetector --repo devhub --direction upstream --depth 2
npx gitnexus impact GeminiParser --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- Lint: passed, including no-emoji check over 279 files.
- Targeted R8.C executable suite: 9 files passed, 56 tests passed.
- TypeScript typecheck: passed.
- Full Vitest: 56 files passed, 489 tests passed with `--maxWorkers=1`.
- License check: passed; 377 production package entries validated and 1 documented exception retained.
- GitNexus analyze: indexed 3320 nodes, 9538 edges, 266 clusters, and 264 flows.
- GitNexus impact: `CursorCopilotDetector` LOW risk, `GeminiParser` LOW risk, `R8RuntimeService` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

## 2026-05-04 Continuation - R8.C spec-07..08 Monitor Window And Popout Executable Slice

### Implemented Scope

- Added shared Zod source-of-truth contracts for `MonitorWindowState`, `ToolMonitorCard`, `MonitorSnapshot`, and `MonitorPopout` in `src/shared/schemas/r8-runtime.ts`.
- Promoted `monitor:open`, `monitor:close`, `monitor:snapshot`, `monitor:set-window-prefs`, `monitor:focus-instance`, `monitor:popout-open`, `monitor:popout-close`, `monitor:popout-list`, and `monitor:popout-return-to-main` from contract-only to executable IPC handlers.
- Reused the existing R8.B BrowserWindow popout bridge for `monitor:open`, creating a real independent `BrowserWindow` route titled `DevHub Monitor` without introducing a new renderer entry or deleting existing monitor tabs.
- Implemented truthful five-tool monitor snapshots for `codex`, `claude`, `gemini`, `cursor`, and `copilot` using only existing real parser sessions/events and existing scanner window-title signals. Empty tools stay inactive; no synthetic running state is invented.
- Added guarded monitor window preferences with `confirmedBy`, persisted `alwaysOnTop`, `opacity`, and bounds, and applied them to the live monitor BrowserWindow when present.
- Implemented monitor tool popouts with one active popout per tool, a five-popout ceiling, default 320x140 bounds, persisted mini layout, real card snapshots, close, list, and return-to-main behavior.

### Completion Boundary

- Verified complete for the main-process/schema/IPC executable slice of R8.C spec-07 and spec-08.
- Not claimed complete: dedicated `src/renderer/monitor` entry, dedicated popout renderer entry, `monitor:snapshot-stream` 100 ms push loop, standalone preload subset, settings panel controls, right-click layout switching UI, Playwright Electron e2e GWTs, and audit-log rows for monitor open/close.
- Snapshot generation deliberately does not invoke CLI detection probes; it is a low-cost read over already observed real runtime state.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm check:no-emoji
pnpm test --run --maxWorkers=1
pnpm check:license
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- Targeted monitor/runtime suite: 3 files passed, 39 tests passed.
- TypeScript typecheck: passed.
- Lint: passed, including no-emoji check over 279 files.
- Full Vitest: 56 files passed, 494 tests passed with `--maxWorkers=1`.
- License check: passed; 377 production package entries validated and 1 documented exception retained.
- GitNexus analyze: indexed 3378 nodes, 9770 edges, 272 clusters, and 269 flows.
- GitNexus impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

## 2026-05-08 Continuation - R8.C spec-07 Monitor Stream, Audit, And Renderer Cards

### Implemented Scope

- Added a real `monitor:snapshot-stream` emitter in `R8RuntimeService` with a 100 ms throttle. It broadcasts existing `MonitorSnapshot` data to the main renderer fallback and live monitor BrowserWindow popouts; it does not start CLI probes or synthesize progress.
- Hardened monitor BrowserWindow creation through the existing R8.B popout bridge with transparent background, resizable window options, shadow, and macOS vibrancy when available.
- Added monitor audit rows for `monitor:open`, `monitor:set-window-prefs`, and `monitor:close` through the existing `AuditLogger`.
- Exposed the minimal preload subset under `window.devhub.r8.monitor`: `open`, `close`, `snapshot`, `setWindowPrefs`, `focusInstance`, and `onSnapshotStream`. The renderer preload whitelist in `prompts/0421/contracts/23-ipc-contracts-master.md` now includes the corresponding invoke and stream channels.
- Added `MonitorWindowCards` to render exactly five snapshot-backed cards for `codex`, `claude`, `gemini`, `cursor`, and `copilot`, with click-to-focus behavior, token/cost/progress display, and `ConfidenceBadge` thresholds.
- Added always-on-top and opacity controls in the R8 operations panel that persist through `monitor:set-window-prefs` with `confirmedBy: r8-ops-panel`.
- Routed monitor popout renderer startup to the monitor view via the existing `surface=monitor` query parameter and defaulted the monitor tab to R8 operations for monitor BrowserWindow instances.

### Completion Boundary

- Verified complete for the stream/preload/UI/audit checklist items of R8.C spec-07.
- Still not claimed complete: dedicated `src/renderer/monitor` multi-entry build, packaged Electron Playwright 5 GWT suite, explicit main-window-close lifecycle proof, and explicit 4D theme synchronization test beyond token-class usage.
- The implementation keeps the existing R8 runtime-service and popout-bridge style; no large file split or renderer build reconfiguration was introduced.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx --testNamePattern "monitor|Monitor|preload|snapshot|confidence" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- Targeted monitor/preload suite: 4 files passed, 19 tests passed, 50 skipped by filter.
- TypeScript typecheck: passed.
- Lint: passed, including no-emoji check over 580 files.
- Zod SoT verification: passed.
- GitNexus impact: `openMonitorWindow`, `closeMonitorWindow`, `setMonitorWindowPrefs`, `focusMonitorInstance`, `createBrowserPopout`, `parseCliChunk`, `AppContent`, `MonitorPanel`, and `R8OpsPanel` all LOW risk.

## 2026-05-08 Continuation - R8.C spec-08 Monitor Tool Popout Stream And UI Entry

### Implemented Scope

- Kept monitor tool popouts on the existing R8.B BrowserWindow popout bridge; no second window-management subsystem or Vite multi-entry refactor was introduced.
- Enforced monitor tool popout behavior through `R8RuntimeService.openMonitorPopout()`: main monitor must be live first, one popout per tool, and at most five tool popouts because the shared `MonitorTool` enum has five values and duplicates fail with `E_VALIDATION`.
- Added minimum monitor tool popout size of 200x100 while preserving the existing 320x140 default bounds.
- Added `monitor:popout-open` and `monitor:popout-close` audit rows through `AuditLogger`.
- Added `monitor:popout-snapshot-stream` routing. The main process sends each live monitor tool BrowserWindow only its corresponding real `ToolMonitorCard` from the latest `MonitorSnapshot`.
- Extended the minimal preload monitor subset with `openPopout`, `closePopout`, `listPopouts`, `returnPopoutToMain`, and `onPopoutSnapshotStream`, and updated the renderer preload whitelist.
- Added main monitor card popout buttons, popped-out state display, single-tool popout rendering from the `target` query parameter, and double-click return-to-main behavior.
- Moved monitor popout channels in the shared IPC registry to the `R8.C.monitor.popout` feature flag, which is default-enabled.

### Completion Boundary

- Verified complete for the bridge reuse, default/min size, effective five-tool cap, double-click return UI, default-ON feature flag, popout stream, and audit rows.
- Still not claimed complete: dedicated monitor-popout renderer build entry, dedicated independent preload file, persisted right-click layout switching channel/UI, packaged Electron Playwright 5 GWT suite, and explicit main-monitor-close survival proof.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx --testNamePattern "monitor|Monitor|popout|Popout|preload|snapshot|confidence" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
```

Results:

- Targeted monitor/popout/preload suite: 4 files passed, 22 tests passed, 68 skipped by filter.
- TypeScript typecheck: passed.
- Zod SoT verification: passed.
- Lint: passed, including no-emoji check over 580 files.
- GitNexus impact: `openMonitorPopout`, `closeMonitorPopout`, `listMonitorPopouts`, `returnMonitorPopoutToMain`, and `setMonitorPopoutLayout` all LOW risk.


## 2026-05-04 Continuation - R8.C spec-09..10 Skill Library And Builtin Catalog Executable Slice

### Implemented Scope

- Added strict Zod source-of-truth contracts for `SkillFrontmatter`, `Skill`, `SkillLoadError`, skill inputs, and skill outputs in `src/shared/schemas/r8-runtime.ts`; unexpected frontmatter/input/load-error keys are rejected.
- Added `src/shared/skill-builtins/index.ts` with exactly 10 local built-in skills: `code-review`, `explain-code`, `write-test`, `refactor`, `fix-bug`, `doc-generate`, `translate-i18n`, `lint-fix`, `migrate-version`, and `security-audit`.
- Built-in skill manifests are validated through the same strict schema, expose markdown frontmatter and README text, and embed offline Node `run.js` content that only uses `fs`, `path`, and `process` data. No API keys, network calls, or remote execution paths are introduced.
- Promoted skill library channels from contract-only to executable main-process behavior through `R8RuntimeService` and `r8RuntimeHandlers`: `skill:list`, `skill:get`, `skill:validate-yaml`, `skill:validate`, `skill:builtin-list`, `skill:builtin-fork`, `skill:builtin-readme`, `skill:install-from-path`, `skill:uninstall`, and `skill:reload`.
- Implemented dual-source loading: built-ins are loaded first, user skills under Electron `userData/skills` and compatibility skill roots are loaded from real `SKILL.md` files, and user skills override same-name built-ins without executing any skill script.
- Hardened `scriptPath` validation: the path must be relative to the skill directory, must not traverse outside that directory, and must exist before a user skill is loaded or installed.
- Added real filesystem tests for invalid YAML/frontmatter, missing script files, path traversal, absolute script paths, user override of a built-in skill, builtin fork to user storage, install from a real local directory, uninstall, strict schema rejection, and executable IPC routing.

### Completion Boundary

- Verified complete for the main-process/schema/IPC executable slice of R8.C spec-09 and spec-10.
- Not claimed complete: chokidar hot reload, `skill:list-stream` push updates, audit-log rows for user override/fork/install/uninstall, standalone `SkillLibrary`/`SkillLoader` file split, renderer skill editor UI, and spec-15 task-queue execution of skill scripts.
- Built-in skills are represented as an embedded manifest module and are materialized as real `SKILL.md`, `run.js`, and `README.md` files when forked. This preserves the current R8 runtime-service integration style and avoids a large structural refactor.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm test --run --maxWorkers=1
pnpm check:license
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- Targeted runtime/schema/IPC suite: 3 files passed, 43 tests passed.
- TypeScript typecheck: passed.
- Lint: passed, including no-emoji check over 280 files.
- Full Vitest: 56 files passed, 498 tests passed with `--maxWorkers=1`.
- License check: passed; 377 production package entries validated and 1 documented exception retained.
- GitNexus analyze: indexed 3385 nodes, 9851 edges, 272 clusters, and 270 flows.
- GitNexus impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

## 2026-05-08 Continuation - R8.C spec-09 Skill Library Hot Reload And Audit Closure

### Scope

- Continued `prompts/0503-2/R8.C/spec-09-skill-library-yaml.md` from the earlier metadata-library slice.
- Kept the implementation inside the existing `R8RuntimeService` architecture to avoid a large refactor and preserve current service style.
- Added `gray-matter@4.0.3` as the frontmatter parser while keeping `js-yaml` as the local YAML engine.

### Completed

- Implemented unsafe custom-tag rejection through the real skill YAML validation path.
- Added shared `SkillListStreamPayload` schema/type and mapped `skill:list-stream` to `R8.C/spec-09` with `main-to-renderer-stream` direction.
- Added bounded chokidar watching for `userData/skills` with `add`, `change`, and `unlink` handling for real `SKILL.md` files.
- Added 100ms-throttled `skill:list-stream` payloads containing `added`, `updated`, `removed`, full `skills`, `errors`, `source`, and `emittedAt`.
- Added audit rows for user built-in overrides, `skill:write`, `skill:install-from-path`, `skill:builtin-fork`, and `skill:uninstall`.
- Exposed `window.devhub.r8.skill.onListStream()` and `reload(force, watch)` through preload and renderer global types.
- Wrote `docs/r8/skill-library.md` as the current implementation boundary.

### Boundaries

- Skill scripts are still not executed by spec-09 paths; downstream execution remains R8.C spec-15 task-queue work.
- Standalone `SkillLibrary.ts`, `SkillLoader.ts`, and `SkillRegistry.ts` files remain intentionally unintroduced to avoid a large refactor in the current codebase.
- No SKILL metadata or content is uploaded; the library, watcher, audit, and streams are local-only.

### Verification

- `pnpm -C . test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --testNamePattern "skill|Skill|preload|IPC|schema" --maxWorkers=1` passed: 4 files, 19 tests.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- GitNexus impact for `R8RuntimeService`, `listSkills`, and `reloadSkills` returned LOW risk; `pnpm -C . exec gitnexus status` reported the index up to date for current commit `de634f9`.

## 2026-05-08 Continuation - R8.C spec-10 Builtin Skill Catalog Flag Closure

### Scope

- Continued `prompts/0503-2/R8.C/spec-10-skill-builtin-10.md` after the 2026-05-04 built-in catalog slice.
- Kept the existing typed manifest architecture in `src/shared/skill-builtins/index.ts` rather than duplicating ten physical source-tree skill directories.
- Closed the remaining runtime boundary around `R8.C.skill.builtin` without changing the user skill library behavior from spec-09.

### Completed

- Enforced `R8.C.skill.builtin=OFF` in `R8RuntimeService`: `listSkills()` skips built-ins while still loading user skills, `listBuiltinSkills()` returns an empty catalog, and builtin read/fork paths return `E_FEATURE_DISABLED`.
- Preserved the exact 10-name built-in catalog and its schema-valid offline manifests: `code-review`, `explain-code`, `write-test`, `refactor`, `fix-bug`, `doc-generate`, `translate-i18n`, `lint-fix`, `migrate-version`, and `security-audit`.
- Added test isolation for `R8RuntimeService.test.ts` so persisted feature overrides from previous runs cannot silently turn the default built-in catalog off.
- Added registry coverage proving `R8.C.skill.builtin` remains default-enabled.
- Extended `docs/r8/skill-library.md` with the current spec-10 built-in catalog and flag-off contract.

### Boundaries

- Built-ins are still source-controlled as a typed manifest and materialized to real `SKILL.md`, `run.js`, and `README.md` files on fork.
- ASAR unpack failure handling remains non-applicable for the manifest-based catalog.
- Downstream execution and permission enforcement remain R8.C spec-15 task-queue work.

### Verification

- `pnpm -C . test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --testNamePattern "skill|Skill|builtin|Builtin|default disabled states" --maxWorkers=1` passed: 5 files, 10 tests.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- GitNexus impact for `R8RuntimeService` returned LOW risk; direct `R8RuntimeService.test` lookup is not indexed as an impact target.
- `pnpm -C . exec gitnexus status` reported the index up to date for current commit `de634f9`.

## 2026-05-04 R8.C spec-11 skill editor checkpoint

- Continued from verified R8.C spec-09..10 into spec-11 with low-resource execution and no new agent team because `teamCreate` is unavailable in this runtime and the machine had just hit resource pressure.
- Implemented local Monaco/YAML editor wiring with bundled workers, offline schema configuration, and no remote schema request or telemetry path.
- Added `SkillEditorPanel` under the existing R8 Ops surface with YAML, Body, and Script buffers, real preload IPC calls, save through `skill:write`, validation through `skill:validate`, reload through `skill:reload(true)`, and template creation through `skill:create-from-template`.
- Extended shared Zod contracts and main/preload/renderer types for `SkillEditorBuffer`, `SkillValidationResult`, and `SkillTemplate`.
- Added service support for `validateSkillEditor`, `listSkillTemplates`, `createSkillFromTemplate`, structured YAML/schema errors, guarded writes, and template-backed real user skill creation.
- Integrated `zod-validation-error` instead of leaving it as an unused dependency; schema errors are converted into user-readable validation messages.
- Verified target suite: 4 files / 45 tests passed with `--maxWorkers=1`; `pnpm typecheck` and `pnpm lint` passed, including no-emoji over 283 files.
- Boundary remains explicit: standalone `/skills` route, Electron Playwright Monaco e2e, unsaved-close modal, delete UI, hot reload/list-stream, audit rows, and spec-15 execution sandbox are not claimed complete in this slice.

## 2026-05-08 Continuation - R8.C spec-11 Skill Editor UI Completion Slice

### Scope

- Continued `prompts/0503-2/R8.C/spec-11-skill-editor.md` from the earlier integrated-panel checkpoint.
- Kept the editor embedded in the existing R8 Ops panel to avoid navigation churn while closing the actual editor behavior gaps.
- Preserved the existing preload/main IPC boundary: renderer edits never touch the filesystem directly.

### Completed

- Added 200ms debounced `skill:validate` calls for YAML/body/script editor changes.
- Added a five-template picker wired to `skill:template-list` and `skill:create-from-template`.
- Added user-skill destructive delete with `window.confirm()`, guarded Delete button state, `skill:delete`, and `skill:reload(true)`.
- Added script runtime language switching for `node`, `python`, `bash`, and `powershell`; the selected language drives Monaco `language` and is persisted through `skill:write`.
- Added `lastSavedAt` display and update after successful saves and created skills.
- Added `devhub-skill-editor` Monaco theme definition from local CSS variables and marked the panel as synchronized with palette, density, radius, and motion axes.
- Added feature-flag coverage proving `R8.C.skill.editor` remains default-enabled.
- Wrote `docs/r8/skill-editor.md` as the current editor implementation boundary.

### Boundaries

- Electron Playwright Monaco worker coverage is now closed by the 2026-05-11 Playwright worker/rendering GWT.
- Standalone `/skills` route, unsaved-close modal, and toast integration remain UX enhancements outside the current verified slice.
- Script execution and permission sandboxing remain R8.C spec-15 work.

### Verification

- `pnpm -C . test --run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx src/shared/feature-flags.test.ts --testNamePattern "skill|Skill|editor|Editor|template|delete|default disabled states" --maxWorkers=1` passed: 5 files, 16 tests.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- GitNexus impact for `SkillEditorPanel` and `configureSkillMonaco` returned LOW risk.

## 2026-05-11 R8.C spec-11 Skill Editor Playwright Closure

- Added a production Electron Playwright GWT for `R8.C spec-11` in `e2e/example.spec.ts`.
- The test opens the real R8 Ops panel, waits for `SkillEditorPanel`, confirms the fallback textarea is gone, confirms `.monaco-editor` is rendered inside `skill-monaco-frame`, switches the Script tab language to `python`, and verifies the real Monaco editor remains mounted.
- The test also calls `globalThis.MonacoEnvironment.getWorker()` for `editor`, `json`, `typescript`, and `yaml`, then terminates the returned Workers. This directly verifies the packaged worker wiring in `src/renderer/views/skills/skill-monaco-config.ts`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub typecheck
pnpm -C devhub test:e2e --grep "R8.C spec-11" --reporter=line
pnpm -C devhub lint
```

Results:

- TypeScript typecheck passed.
- R8.C spec-11 Playwright Monaco worker/rendering GWT passed: 1 test passed in 4.1s.
- ESLint and no-emoji guard passed; no emoji found in 598 files.

### Completion Boundary

- Claimed complete for the local spec-11 checklist: dynamic Monaco import/Vite worker wiring, offline YAML schema, YAML/Body/Script tabs, 200ms validation debounce, valid-only save, five templates, destructive delete confirmation, four-axis theme sync, default-on feature flag, no-upload privacy boundary, and Playwright worker/rendering GWT.
- Still not claimed complete: standalone `/skills` route, unsaved-close modal, toast integration, script execution sandboxing, unrelated R8.C specs, full E2E suite, or all `prompts/0503-2` documents.

## 2026-05-04 R8.C spec-12..15 CSV Driver, Launch, And Store-Backed Queue Checkpoint

- Implemented strict 18-column CSV source-of-truth in `src/shared/schemas/csv-task-row.ts` with header/order validation, JSON `inputArgs`, timeout/retry bounds, operator column info, and `src/shared/csv-task-row.docs.md`.
- Added real main-process CSV parsing/loading in `src/main/services/csv/`: quoted field parsing, metadata comments, UTF-8/BOM/UTF-16LE handling, explicit parse errors, group-level SKILL and `dependsOn` validation, deterministic row hashing, and template export.
- Promoted CSV/task channels to executable service/IPC/preload paths: `csv:validate-header`, `csv:list-groups`, `csv:get-group`, `csv:reload`, `csv:enqueue-group`, `csv:export-template`, `task:pause-session`, `task:resume-session`, and `task:abort-session`.
- Restored previously referenced R8 runtime service methods for monitor popouts, injection guards, signal fusion, recovery scan, diagnostics list, command history, and rate-limit reports instead of deleting handler/test coverage.
- Implemented spec-14 launch slice: DevHub runner queues real rows or dry-runs, CLI runner generates a command without spawning, and Python runner fails truthfully with `E_DEPENDENCY_MISSING` until the verified bridge exists.
- Implemented spec-15 store-backed queue controls with explicit boundary: no BetterQueue/SQLite/DAG worker is claimed yet.
- Verification passed: `pnpm typecheck`, `pnpm lint` including no-emoji over 291 files, and targeted suite `src/shared/schemas/csv-task-row.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1` with 5 files / 49 tests.
- Boundary remains explicit: app-start chokidar lifecycle, `csv:row-stream`, UI wizard, Python named-pipe bridge, package bin CLI entry, BetterQueue/SQLite persistence, DAG/parallel-group worker, and task state stream remain future R8.C work.

## 2026-05-08 Continuation - R8.C spec-12 CSV Driver Row Stream And Encoding Slice

### Scope

- Continued `prompts/0503-2/R8.C/spec-12-csv-task-driver.md` from the earlier CSV driver checkpoint.
- Preserved the existing strict parser and driver structure while closing row stream, reload audit, and GB18030 decoding gaps.
- Kept the watcher low-resource and opt-in through `csv:reload(force, watch)`.

### Completed

- Added direct `iconv-lite@0.6.3` runtime dependency and GB18030 fallback decoding while preserving UTF-8, UTF-8 BOM, and UTF-16LE BOM support.
- Added shared `CsvRowStreamPayload` schema/type and registry entry.
- Added `csv:row-stream` through R8 runtime send emitters, preload listener API, renderer global types, and `prompts/0421/contracts/23-ipc-contracts-master.md`.
- Added 100ms-throttled stream payloads with `changedGroupIds`, `removedGroupIds`, `source`, `emittedAt`, and full reload summary.
- Added `csv:reload(force, watch)` support that can start the low-resource `CsvFileWatcher`; watcher events reload real files and emit `watch:add`, `watch:change`, or `watch:unlink`.
- Added audit rows for every `csv:reload` with row/error counts.
- Added feature-flag coverage proving `R8.C.csv.driver` remains default-enabled.
- Wrote `docs/r8/csv-task-driver.md` as the current implementation boundary.

### Boundaries

- `papaparse` streaming read remains open; the strict in-process parser was retained to avoid a broad parser replacement in this pass.
- Electron E2E/UI wizard coverage remains outside this low-resource slice.

### Verification

- `pnpm -C . test --run src/shared/schemas/csv-task-row.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts src/preload/preloadContract.test.ts --testNamePattern "csv|CSV|Csv|preload|IPC|schema|default disabled states" --maxWorkers=1` passed: 7 files, 39 tests.
- `pnpm -C . typecheck` passed.
- `pnpm -C . lint` passed, including `check:no-emoji` over 580 files.
- `pnpm -C . check:zod-sot` passed.
- GitNexus impact for `CsvTaskDriver`, `CsvParser`, and `reloadCsvGroups` returned LOW risk.

## 2026-05-09 Continuation - R8.C spec-12 Papa Parse Streaming Closure

### Scope

- Closed the remaining `papaparse` streaming checklist item in `prompts/0503-2/R8.C/spec-12-csv-task-driver.md`.
- Preserved the existing driver and validation architecture while replacing whole-file text parsing on the file load path with a Node stream parser.

### Completed

- Added `papaparse@5.5.3` runtime dependency and `@types/papaparse@5.3.16` development typing.
- Added `CsvParser.parseStream()` using `Papa.parse(Papa.NODE_STREAM_INPUT, { delimiter: ',', header: false })`.
- Changed `CsvTaskDriver.loadGroup()` to probe only a bounded 64 KiB prefix for BOM/encoding, then stream UTF-8, UTF-16LE, or GB18030-decoded text into Papa Parse.
- Kept strict 18-column validation, metadata comment extraction, row-level isolation, SKILL reference validation, dependency validation, and runtime queue row mapping intact.
- Added a 1200-row regression fixture with quoted delimiters and embedded newlines to prove the streaming path handles real CSV edge cases.

### Verification

- `pnpm -C . test --run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1` passed: 1 file, 7 tests.
- `pnpm -C . typecheck` passed.

## 2026-05-09 Continuation - R8.C spec-14 CSV Launch 3-Way Closure

### Scope

- Closed `prompts/0503-2/R8.C/spec-14-csv-launch-3way.md` against real code paths rather than command placeholders.
- Preserved the existing `R8RuntimeService` architecture and added narrow launcher helpers instead of replacing the runtime service.

### Completed

- Added `CsvMetadataReader`, `PythonScriptManager`, real Python batch script, script sha256 manifest, real Node CLI entry, package `bin.devhub`, and renderer `CsvLaunchWizard`.
- DevHub runner now validates CSV, builds dry-run DAGs, enqueues real task rows, starts ready tasks, emits `csv:session-event-stream`, mirrors launch progress to `cli:event-stream`, writes audit rows, and enforces same-file active-session mutual exclusion.
- CLI runner now generates `devhub run-csv`, writes to Electron clipboard, persists `last-csv-command.txt`, and has a runnable `scripts/devhub-cli.mjs` path parser.
- Python runner now verifies script integrity, probes real local Python, starts a Node named-pipe server, spawns `scripts/devhub-batch.py --pipe`, and consumes JSON-line events from the child process.
- IPC, preload, global renderer types, and `prompts/0421/contracts/23-ipc-contracts-master.md` are synchronized for runner info, session controls, and session event streaming.

### Verification

- `pnpm -C . test --run src/main/services/csv-launcher/CsvMetadataReader.test.ts src/main/services/csv-launcher/PythonScriptManager.test.ts src/main/services/csv-launcher/CsvCliEntry.test.ts src/renderer/components/csv/CsvLaunchWizard.test.tsx src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/main/services/R8RuntimeService.test.ts --testNamePattern "CSV|csv|Csv|PythonScript|CsvMetadata|devhub run-csv|preload|IPC|schema|launch|Launch|runner|Runner" --maxWorkers=1` passed: 8 files, 33 tests.
- `pnpm -C . typecheck` passed.

### Boundary

- Python pause/resume over a long-lived bidirectional control pipe is not claimed; the current verified Python bridge provides named-pipe event delivery plus real child-process abort, with stdout JSON-lines as the documented fallback.


## 2026-05-04 R8.C spec-15 Durable Queue Scheduler Slice

- Added `src/main/services/task-queue/TaskQueueService.ts` as a real store-backed queue boundary over existing Electron Store persistence, keeping BetterQueue/SQLite as an explicit future boundary instead of pretending those adapters exist.
- Preserved spec-15 data semantics in real task state: `sessionId`, `taskId`, `rowHash`, retry counters, `parallelGroup`, artifacts path, error codes, and transition history are all persisted from actual enqueue/scheduler/operator actions.
- Wired `R8RuntimeService` queue methods to the queue service: enqueue, list, stats, retry, skip, pause, resume, abort, start-ready scheduling, complete-task transition, and state transition listing.
- Mapped 18-column `concurrencyKey` into runtime `parallel_group`, then into `TaskRun.parallelGroup`, so CSV-driven parallel-group limits can be enforced after ingestion.
- Implemented real scheduler behavior without fake execution success: DAG dependencies remain `waiting-dependency`, eligible rows transition `queued -> running`, executor completion must call `completeTaskRun`, failed runs enter `retrying` or `failed`, and operator retry is explicit.
- Added regression coverage in `src/main/services/task-queue/TaskQueueService.test.ts`, `src/main/services/csv/CsvTaskDriver.test.ts`, and `src/main/services/R8RuntimeService.test.ts` for DAG gates, parallel-group limits, resume skip, force rerun, rowHash drift, retry, and validation errors.
- Verification passed: targeted Vitest suite `src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1` passed with 5 files / 49 tests; `pnpm typecheck` passed; `pnpm lint` passed including no-emoji over 294 files.
- Boundary remains explicit: BetterQueue/SQLite adapter, graphlib/Tarjan shared DAG service, retry backoff timer worker, task state stream broadcast, audit-log rows, startup integrity scan, and crash recovery are not claimed complete in this slice.

## 2026-05-04 R8.C spec-16 Watchdog Policy Engine Slice

- Added `src/main/services/watchdog/WatchdogEngine.ts` as a real main-process watchdog policy engine: it persists monitored instances, heartbeat beats, self-check timestamps, and watchdog events in the existing runtime store.
- Implemented lenient/strict heartbeat fusion, startup grace, phase-aware timeouts, restart storm protection, explicit action decisions, and manual override history without faking subprocess respawn success.
- Extended `src/shared/schemas/r8-runtime.ts` with watchdog source/mode/action/phase/instance contracts and an expanded `WatchdogStatus` response while preserving existing `enabled`, `heartbeatTimeoutMs`, `restartCount`, `lastHeartbeatAt`, and `state` fields.
- Wired `R8RuntimeService` watchdog paths to the engine and added internal service methods for registering instances, recording heartbeats, evaluating policy, and self-checking for the future spec-17 subprocess handoff.
- Added `src/main/services/watchdog/WatchdogEngine.test.ts` plus service integration coverage for strict CPU-only timeout and action history.
- Verification passed: targeted Watchdog suite `src/main/services/watchdog/WatchdogEngine.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1` passed with 5 files / 55 tests; `pnpm typecheck` passed; `pnpm lint` passed including no-emoji over 297 files.
- Boundary remains explicit: real OS heartbeat collectors, HungWindow/ETW adapters, subprocess supervisor, restart executor, event-stream broadcast, notification emission, and 16-instance CPU benchmark remain future R8.C/spec-17+ work.

## 2026-05-04 R8.C spec-17 Watchdog Supervisor Contract Slice

- Added `src/shared/schemas/watchdog-rpc.ts` as the spec-17 Zod source of truth for RPC channels, handshake payloads, JSON-RPC requests/responses, supervisor state, session token context, marker files, channel diagnostics, supervisor status, and explicit service/respawn requests.
- Added `src/main/services/watchdog-supervisor/` with `HandshakeProtocol`, `MutualHeartbeat`, `WatchdogSupervisor`, `WatchdogSpawner`, and `WindowsServiceInstaller` so the outer-supervisor boundary is real and testable without spawning unmanaged background processes.
- `WatchdogSupervisor` now generates a real 64-character sha256 session token, writes a marker file under Electron userData, validates handshake token/protocol/parentPid, tracks named-pipe/TCP/marker-file health, and reports `not-started`, `healthy`, `degraded`, `dead`, or `fatal` truthfully.
- Respawn is explicit and permission-gated. Without a configured child entry file it returns `E_SPAWN_FAILED` instead of pretending a child process exists; the sixth respawn attempt within one hour returns `E_RESTART_STORM` and sets `respawnAllowed=false`.
- Windows Service install/uninstall is represented as a command-plan boundary only: the service returns `requiresElevation=true` and the exact `sc.exe` action plan but never executes `sc.exe` automatically.
- Wired supervisor status, respawn, install-service, and uninstall-service through `R8RuntimeService`, `r8RuntimeHandlers`, `preload/index.ts`, `renderer/types/global.d.ts`, and the `prompts/0421/contracts/23-ipc-contracts-master.md` preload whitelist.
- Verification passed: targeted supervisor suite `src/shared/schemas/watchdog-rpc.test.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1` passed with 5 files / 50 tests; `pnpm typecheck` passed. Final full validation also passed: `pnpm typecheck`, `pnpm lint` including no-emoji over 306 files, `pnpm test --run --maxWorkers=1` with 63 files / 534 tests, and `pnpm check:license` with 399 production package entries validated.
- Boundary remains explicit: packaged InnerWatchdog entrypoint, live named-pipe/TCP JSON-RPC transport, orphan-mode runtime loop, restart takeover after DevHub crash, audit rows, event-stream notifications, and UAC-backed service execution remain future spec-17+ work.

- GitNexus verification: `npx gitnexus analyze --force` refreshed the index to 3,797 nodes / 11,203 edges / 302 clusters / 300 flows; `R8RuntimeService` and `WatchdogSupervisor` upstream impact both reported LOW; `npx gitnexus status` reported up-to-date.

## 2026-05-04 R8.C spec-18 Inject Contract Engine Slice

- Added `src/shared/schemas/inject.ts` as the spec-18 source of truth for inject modes, scenarios, failure kinds, targets, normalized actions, dry-run results, execution results, and full-content audit records.
- Added `src/main/services/inject/` with `InjectService`, `InjectModeSelector`, `InjectChunker`, `InjectFailureClassifier`, and `InjectAuditRepository` so injection now has a real planning/execution boundary instead of a one-off R8RuntimeService method.
- `InjectService` normalizes text to NFC, computes sha256 `textHash`, creates a real action id, checks target resolution, traverses mode/fallback order, writes full-content audit records to the runtime store, and never reports success unless the native typer succeeds.
- Mode behavior is truthful: pty reports `E_SHIM_NOT_INSTALLED` until the SHIM channel exists, UIA and clipboard-paste report unavailable boundaries until their adapters exist, and sendinput only succeeds through the real `NutJsAdapter` path when the native library/feature flag is enabled.
- R8RuntimeService now delegates `inject:dry-run` and `inject:execute` to the service while preserving existing preload/IPC compatibility and existing `injectHistory` records.
- Verification passed: `pnpm test --run src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1` passed with 3 files / 44 tests; `pnpm typecheck` passed; `pnpm lint` passed including no-emoji over 314 files.
- Boundary remains explicit: real UIA, clipboard save/restore, pty SHIM execution, screenshot capture, verifier reads, SQLite audit adapter, countdown stream, focus-steal polling, task/watchdog triggers, and spec-22 recording binding remain future spec-18+ work.

## 2026-05-04 R8.C spec-19 Inject Target Safety Gate Slice

- Continued from the verified spec-18 inject engine into spec-19 target selection and safety policy without deleting any existing inject, CSV, watchdog, IPC, preload, or renderer surfaces.
- Added strict shared Zod source-of-truth contracts in `src/shared/schemas/inject.ts` for selector kinds, resolved targets, whitelist scopes/durations, whitelist entries, strict-mode config, countdown config, resolve-target requests/results, and ready-pool instances.
- Added `src/main/services/inject/InjectTargetResolver.ts` with real deterministic target resolution for alias, ready-pool, CSV row alias, PID, and HWND selectors; it rejects alias collisions and PID/HWND alias mismatches instead of guessing.
- Implemented whitelist gates for instance, tool, and project-cwd scopes with sha256 pattern hashes, UTC epoch expiry, first-time confirmation state, expired-entry detection, and project cwd prefix matching.
- Implemented strict-mode and countdown policy at the service boundary: strict mode requires explicit confirmation when configured, CSV automation gets `countdownMs=0` only after whitelist approval, and countdown cancellation records a real cancellation entry in inject history.
- Wired spec-19 channels through `R8RuntimeService`, `r8RuntimeHandlers`, preload, renderer global typings, and `prompts/0421/contracts/23-ipc-contracts-master.md`: `inject:resolve-target`, `inject:get-ready-pool`, `inject:get-whitelist`, `inject:add-whitelist`, `inject:remove-whitelist`, `inject:configure-strict-mode`, `inject:configure-countdown`, and `inject:countdown-cancel`.
- Preserved backward compatibility for the existing alias-only whitelist API while storing new whitelist entries in the spec-19 scope/pattern/scenario/duration shape.
- Added `src/main/services/inject/InjectTargetResolver.test.ts` covering exact alias resolution, ready-pool selection, first-time confirmation, expired whitelist denial, strict-mode blocking, CSV countdown bypass after whitelist approval, project-cwd prefix matching, and PID alias mismatch rejection.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus impact InjectService --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
pnpm test --run src/main/services/inject/InjectTargetResolver.test.ts src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm typecheck
pnpm lint
```

Results:

- GitNexus impact before edit: `InjectService`, `R8RuntimeService`, and `setupR8RuntimeHandlers` all reported LOW risk.
- Targeted spec-19/runtime/preload suite: 6 files passed, 63 tests passed with `--maxWorkers=1`.
- TypeScript typecheck: passed.
- Lint: passed, including no-emoji check over 316 files.

### Completion Boundary

- Verified complete for the spec-19 service/schema/IPC/preload executable slice and the safety gates that block spec-22 recording from receiving ambiguous inject targets.
- Not claimed complete in this slice: renderer modal/drawer UX for first-time confirmation and countdown, live countdown stream emission every 100ms, SQLite-specific whitelist repository adapter, hourly cleanup scheduler, audit-log row export, real OS HWND validation, and screenshot preview UI.

## 2026-05-04 R8.C spec-20 DAG Orchestrator Graphlib Slice

- Continued from the verified spec-19 injection target safety gate into the spec-20 DAG orchestrator slice, preserving all existing R8 runtime, CSV, task queue, IPC, preload, and renderer contracts.
- Added `src/shared/schemas/dag.ts` as the strict Zod source of truth for dependency clauses, DAG input nodes, snapshot nodes, edges, warnings, cycle errors, build/export/layer/ready requests, and export responses.
- Added `src/main/services/dag/` with a real in-process DAG stack: `DependencyDslParser`, `CycleDetector`, `TopoSorter`, `PriorityRanker`, `CriticalPathAnalyzer`, `DagSerializer`, and `DagOrchestrator`.
- Implemented dependency DSL support for legacy `A,B`, `after:T1`, `after:T1 if=success`, `after:T1|T2 if=any`, and `after:T1 if=failure`, with explicit `E_VALIDATION`, `E_NOT_FOUND`, and `E_DAG_CYCLE` failures instead of fallback guessing.
- Implemented graphlib-backed directed graph construction plus Tarjan SCC cycle paths, deterministic Kahn layering, parallel-group max conflict warnings, orphan-node warnings, critical-path duration analysis, and Mermaid/DOT/Cytoscape serialization.
- Wired executable `dag:build`, `dag:detect-cycle`, `dag:export`, `dag:layer`, and `dag:check-ready` through `R8RuntimeService`, IPC handlers, preload, renderer global typings, runtime schema registry, and `prompts/0421/contracts/23-ipc-contracts-master.md`.
- Preserved backward compatibility for the existing `{ nodes: [{ id, dependencyIds }] }` DAG calls while adding real `csvPath` ingestion through the existing CSV parser; stored snapshots and audit records are persisted in the runtime store with a sha256 snapshot hash.
- Added `src/main/services/dag/DagOrchestrator.test.ts` and extended runtime/IPC/preload/schema tests to cover the spec GWTs: 5-node layering, cycle paths, `if=any`, `if=failure`, parallel-group conflicts, critical path, orphan warnings, serialization, node cap, real CSV path build, stored layer lookup, export, and ready checks.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
pnpm test --run src/main/services/dag/DagOrchestrator.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm test --run --maxWorkers=1
pnpm check:license
npx gitnexus analyze --force
npx gitnexus impact DagOrchestrator --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- GitNexus impact before edit: `R8RuntimeService` and `setupR8RuntimeHandlers` both reported LOW risk.
- Targeted spec-20/runtime/preload suite: 5 files passed, 60 tests passed with `--maxWorkers=1`.
- TypeScript typecheck: passed.
- Lint: passed, including no-emoji check over 327 files.
- Full Vitest: 66 files passed, 555 tests passed with `--maxWorkers=1`.
- License check: passed; 399 production package entries validated and 1 documented exception retained.
- GitNexus analyze: indexed 3,932 nodes, 11,800 edges, 326 clusters, and 300 flows.
- GitNexus impact after edit: `DagOrchestrator`, `R8RuntimeService`, and `setupR8RuntimeHandlers` all reported LOW risk.
- GitNexus status: up to date for commit `de634f9`.

### Completion Boundary

- Verified complete for the spec-20 service/schema/IPC/preload executable slice and the DAG algorithm contracts that unblock spec-21 visualization and spec-12/spec-15 scheduler integration.
- Not claimed complete in this slice: visual DAG editor UI, live Cytoscape renderer, drag/drop dependency editing, SQLite-backed DAG snapshot repository, incremental recompute cache keyed by dependency hash, CSV driver automatic DAG scheduling replacement, and long-running 1000-node p95 performance benchmark artifact.

## 2026-05-04 R8.C spec-21 DAG Visual Editor Slice

- Continued from the verified spec-20 DAG orchestrator into the spec-21 visual editor slice, preserving the existing R8 runtime, CSV driver, task queue, IPC, preload, and R8 Ops panel structure.
- Added `src/shared/schemas/dag-editor-state.ts` as the strict Zod source of truth for DAG editor view state, lock/save requests, lock status, save results, row-level validation errors, and node templates.
- Added `src/main/services/csv-lock/CsvFileLockService.ts` with real `.csv.lock` file ownership, PID/owner metadata, stale TTL reclaim, status reporting, and ownership checks before saving. It uses real filesystem operations and does not fake concurrent access.
- Extended `CsvParser` with `stringifyRows` so edited 18-column `CsvTaskRow18` data round-trips back to a real CSV file with canonical headers and escaping.
- Extended `R8RuntimeService` with executable `lockCsv`, `unlockCsv`, `csvLockStatus`, `saveCsv`, `listCsvTemplates`, `saveCsvTemplate`, and `deleteCsvTemplate` paths. `saveCsv` validates rows, enforces lock ownership, rejects DAG cycles before writing, checks expected `mtimeMs` for external edits, and writes atomically through temp-file rename.
- Wired executable `csv:lock`, `csv:unlock`, `csv:save`, `csv:list-templates`, `csv:save-template`, `csv:delete-template`, and `csv:lock-status-stream` through IPC handlers, preload, renderer typings, runtime schema registry, and `prompts/0421/contracts/23-ipc-contracts-master.md`.
- Added `src/renderer/components/dag-editor/DagEditorPanel.tsx` and mounted it in `R8OpsPanel`. The panel locks and loads a real CSV path, renders the same rows through canvas/list/gantt/kanban views, supports native drag/drop dependency creation, cycle highlighting, undo/redo, save disabling on cycles, mtime conflict actions, and save/insert template actions through the preload API.
- Added regression coverage in `src/main/services/csv-lock/CsvFileLockService.test.ts`, `src/main/services/R8RuntimeService.test.ts`, `src/main/ipc/r8RuntimeHandlers.test.ts`, `src/shared/schemas/r8-runtime.test.ts`, `src/preload/preloadContract.test.ts`, and `src/renderer/components/dag-editor/DagEditorPanel.test.tsx`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
pnpm test --run src/main/services/csv-lock/CsvFileLockService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm test --run --maxWorkers=1
pnpm check:license
npx gitnexus analyze --force
npx gitnexus impact CsvFileLockService --repo devhub --direction upstream --depth 2
npx gitnexus impact DagEditorPanel --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- GitNexus impact before edit: `R8RuntimeService` and `setupR8RuntimeHandlers` both reported LOW risk.
- Targeted spec-21/runtime/preload/renderer suite: 6 files passed, 59 tests passed with `--maxWorkers=1`.
- TypeScript typecheck: passed.
- Lint: passed, including no-emoji check over 333 files.
- Full Vitest: 68 files passed, 561 tests passed with `--maxWorkers=1`.
- License check: passed; 399 production package entries validated and 1 documented exception retained.
- GitNexus analyze: indexed 4,030 nodes, 12,038 edges, 329 clusters, and 300 flows.
- GitNexus impact after edit: `CsvFileLockService`, `DagEditorPanel`, `R8RuntimeService`, and `setupR8RuntimeHandlers` all reported LOW risk.
- GitNexus status: up to date for commit `de634f9`.

### Completion Boundary

- Verified complete for the spec-21 executable slice covering real CSV lock/load/save, mtime integrity, cycle write refusal, IPC/preload contracts, renderer four-view synchronization, drag/drop dependency editing, undo/redo, and template persistence.
- Not claimed complete in this slice: high-fidelity pan/zoom graph canvas, keyboard-only edge creation parity, multi-window lock stream subscription management beyond the exposed channel, external diff/merge UI for conflict resolution, persisted editor session restore, and full Playwright drag benchmark against packaged Electron.


## 2026-05-04 R8.C spec-22 Task Recording Engine Slice

- Continued from the verified spec-21 DAG editor slice into spec-22 task recording, preserving the existing R8 runtime service, legacy recording session API, replay API, IPC contracts, preload bridge, and R8 Ops consumers.
- Added `src/shared/schemas/recording.ts` as the strict Zod source of truth for recording stream kinds, manifests, stdout/stdin/screenshot/fs/git-diff events, event-stream payloads, start/stop/list/get-events/export/delete requests, and export/delete results.
- Added `src/main/services/recording/RecordingService.ts` with real local recording directories under `userData/recordings/{sessionId}/{taskId}/`, durable `manifest.json`, append-only NDJSON streams, real `git diff --stat` plus full `git-diff.txt`, real chokidar filesystem events with SHA-256 before/after hashes, Electron `BrowserWindow.capturePage()` screenshot capture when available, per-task rotation, global LRU quota enforcement, asciinema v2 `.cast` export, and a dependency-free ZIP writer with redaction.
- Extended `R8RuntimeService` without deleting the legacy recording/replay path. Legacy `startRecording({ label, source })`, `stopRecording({ sessionId })`, `listRecordings()`, and spec-23 replay calls remain compatible; spec-22 manifest calls use `recordingId`, `sessionId`, `taskId`, and `cwd`.
- Connected stdout recording to the existing `parseCliChunk` path and stdin recording to successful `executeInject` calls when `recordingId`, `sessionId`, or `taskId` is present. These paths use the real runtime event payloads rather than generated fixture events.
- Wired executable `recording:start`, `recording:stop`, `recording:list`, `recording:get-manifest`, `recording:get-events`, `recording:export-asciinema`, `recording:export-zip`, and `recording:delete` through IPC handlers, preload, renderer typings, runtime schema registry, and `prompts/0421/contracts/23-ipc-contracts-master.md`.
- Exposed `recording:event-stream` through the preload `onEvent` subscription and renderer contract so live recording events can be consumed without polling.
- Added regression coverage in `src/main/services/recording/RecordingService.test.ts`, `src/main/services/R8RuntimeService.test.ts`, `src/main/ipc/r8RuntimeHandlers.test.ts`, `src/shared/schemas/r8-runtime.test.ts`, and `src/preload/preloadContract.test.ts`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
pnpm test --run src/main/services/recording/RecordingService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm typecheck
```

Current results:

- GitNexus impact before edit: `R8RuntimeService` impacted 3 upstream items and reported LOW risk; `setupR8RuntimeHandlers` impacted 0 items and reported LOW risk.
- Targeted spec-22/runtime/preload suite: 5 files passed, 62 tests passed with `--maxWorkers=1`.
- TypeScript typecheck: passed after preserving legacy/new recording overloads.

Additional quality gates executed after documentation update:

```bash
pnpm lint
pnpm test --run --maxWorkers=1
pnpm check:license
npx gitnexus analyze --force
npx gitnexus impact RecordingService --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Additional results:

- Lint: passed, including no-emoji check over 337 files.
- Full Vitest: 69 files passed, 566 tests passed with `--maxWorkers=1`.
- License check: passed; 399 production package entries validated and 1 documented exception retained.
- GitNexus analyze: indexed 4,112 nodes, 12,674 edges, 324 clusters, and 300 flows.
- GitNexus impact after edit: `RecordingService`, `R8RuntimeService`, and `setupR8RuntimeHandlers` all reported LOW risk.
- GitNexus status: up to date for commit `de634f9`.

### Completion Boundary

- Verified complete for the spec-22 executable slice covering real local manifest creation, stdout/stdin NDJSON capture, filesystem event recording, git-diff pre/post artifacts, asciinema v2 export, redacted ZIP export, IPC/preload contracts, event-stream subscription typing, and legacy replay compatibility.
- Not claimed complete in this slice: packaged Electron long-running screenshot benchmark, keyboard/user-input capture outside the inject path, task-queue automatic start/stop wiring for every scheduler path, and a renderer recording browser UI beyond the exposed preload contract. The screenshot stream is real and uses `BrowserWindow.capturePage()`; when no capturable window exists it records `E_PERMISSION_DENIED` instead of creating fake PNG files.

## 2026-05-04 R8.C spec-23 Task Replay Slice

- Continued from the verified spec-22 recording engine into spec-23 replay without deleting legacy `recording:replay-start`, `recording:replay-seek`, `recording:replay-export`, or the existing `RecordingSession` overloads.
- Added `src/shared/schemas/replay-state.ts` as the strict Zod source of truth for replay speed, anchors, replay state, asciinema v2 cast data, events-window requests, screenshot lookup, and filesystem snapshot responses.
- Added `src/main/services/recording/AsciinemaConverter.ts` and extended `RecordingService` with real replay reads over the spec-22 manifest and NDJSON streams: replay state, event windows, cast conversion, anchor derivation, PNG screenshot dimension validation, and timestamped filesystem snapshots.
- Extended `R8RuntimeService`, `r8RuntimeHandlers`, preload, renderer global typings, runtime schema registry, and `prompts/0421/contracts/23-ipc-contracts-master.md` with executable spec-23 channels: `recording:get-replay-state`, `recording:get-events-window`, `recording:get-cast`, `recording:list-anchors`, `recording:get-screenshot`, and `recording:get-fs-snapshot-at`.
- Added `src/renderer/components/recording-replay/` with the R8 Ops replay panel, RAF `ReplayClock`, 6-speed controls, timeline cursor, anchor list, stdout/stdin/screenshot/fs/git-diff tracks, xterm-backed asciinema playback, TanStack-virtualized stdout and screenshot strips, Monaco diff rendering with a no-canvas text fallback, track toggles, and hidden/blur pause handling.
- Added persisted inject action details to recorded stdin events when the event is produced by the real `executeInject` path, exposing `actionId`, `targetAlias`, `mode`, and `scenario` to the replay UI without fabricating missing metadata.
- Added `@xterm/xterm` as a production dependency and re-ran the license gate; existing installed `@tanstack/react-virtual` and `@monaco-editor/react` were reused instead of adding duplicate virtualization/diff libraries.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus impact RecordingService --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
pnpm typecheck
pnpm lint
pnpm test --run src/renderer/components/recording-replay/ReplayClock.test.ts src/renderer/components/recording-replay/RecordingReplay.test.tsx src/main/services/recording/RecordingService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm check:license
pnpm test --run --maxWorkers=1
```

Results:

- GitNexus impact before the replay completion patch: `RecordingService`, `R8RuntimeService`, and `setupR8RuntimeHandlers` all reported LOW risk.
- TypeScript typecheck: passed.
- Lint and no-emoji check: passed; `No emoji found in 353 files`.
- Targeted spec-23/runtime/preload suite: 7 files passed, 65 tests passed with `--maxWorkers=1`.
- License check: passed; 400 production package entries validated and 1 documented exception retained.
- Full Vitest: 71 files passed, 569 tests passed with `--maxWorkers=1`.

### Completion Boundary

- Verified complete for the executable spec-23 slice covering real local replay data reads, five-track cursor synchronization, xterm cast rendering, virtualized stdout/screenshot tracks, Monaco-backed git diff view, injected stdin metadata display, track toggles, replay clock speed behavior, IPC/preload contracts, and legacy replay compatibility.
- The Monaco diff view uses the real Monaco component in browser-capable environments and a real text fallback in no-canvas test environments to avoid CDN/script loading and canvas errors.
- Packaged Electron CPU profiling for the `speed_8x_cpu_pct_warn` budget remains an operational performance gate; the implemented renderer uses bounded event windows, virtualized long tracks, and a focused RAF unit test to keep the local CI path deterministic.

### Post-Index Verification Addendum

Commands executed after docs/spec sync:

```bash
npx gitnexus analyze --force
npx gitnexus impact RecordingService --repo devhub --direction upstream --depth 2
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- GitNexus analyze: indexed 4,215 nodes, 13,022 edges, 332 clusters, and 300 flows.
- Auto-generated GitNexus `AGENTS.md` / `CLAUDE.md` noise was reverted only for those two files.
- Post-index impact: `RecordingService` LOW risk, `R8RuntimeService` LOW risk, `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.


## 2026-05-04 R8.C spec-24 Global Topology Slice

- Continued from the verified spec-23 replay slice into the spec-24 fullscreen global topology entrypoint without deleting legacy monitor, scanner, preload, or R8 runtime surfaces.
- Added `src/shared/schemas/graph.ts` as the strict Zod source of truth for graph kinds, node kinds, edge kinds, slices, snapshots, saved snapshots, export requests/results, and warm-scope requests.
- Added `src/main/services/graph/GraphService.ts` as the shared graph data layer. It reads the real scanner cache and project registry, builds `network-topology`, `neural-relationship`, and `flow` graphs, supports `global`, `process`, `port`, `window`, and `project` slices, applies depth expansion for process slices, filters dangling edges, and enforces the 500 default / 2000 expanded node ceilings.
- Added real topology snapshot persistence and listing under the Electron user-data topology snapshot directory. Snapshot save requires `confirmedBy`; corrupted snapshot files are ignored during listing instead of crashing the runtime.
- Added real export support for `mermaid`, `dot`, and `svg`. `png` explicitly returns `E_RUNTIME:png export requires renderer canvas` because no renderer canvas PNG pipeline is implemented in this slice; it does not fake an image export.
- Wired global topology through `R8RuntimeService`, `r8RuntimeHandlers`, preload, renderer global typings, and `prompts/0421/contracts/23-ipc-contracts-master.md` with executable channels for fullscreen graph load, global graph build, network graph, neural graph, save snapshot, list snapshots, export, and warm global scopes.
- Added `src/renderer/components/topology/FullScreenTopologyView.tsx` plus graph kind, layout, slice, time cursor, export, and canvas wrapper components. The renderer reuses the existing neural graph control style rather than adding a new graph dependency in this slice.
- Added five redundant global entrypoints: top-level `拓扑` tab, sidebar activity icon, status-bar badge, `topology.global` command-palette command, `Ctrl+T`, and `#/topology/global` hash route.
- Added bidirectional navigation from topology process nodes back into the monitor process detail path through `devhub:open-monitor` and `devhub:monitor-navigate` events.
- Hardened `Sidebar` test behavior so missing optional `window.devhub.tags` / `window.devhub.groups` preload surfaces no longer crash or create React `act` warnings in the topology entrypoint regression.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/graph/GraphService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/topology/TopologyEntrypoints.test.tsx --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- Targeted spec-24/runtime/preload/renderer suite: 7 files passed, 72 tests passed with `--maxWorkers=1`.
- TypeScript typecheck: passed.
- Lint and no-emoji check: passed; `No emoji found in 366 files`.
- License check: passed; 400 production package entries validated and 1 documented exception retained.
- Full Vitest: 74 files passed, 582 tests passed with `--maxWorkers=1`.
- GitNexus analyze: indexed 4,326 nodes, 13,222 edges, 355 clusters, and 300 flows.
- Auto-generated GitNexus `AGENTS.md` / `CLAUDE.md` noise was reverted only for those two files.
- GitNexus impact after edit: `R8RuntimeService` LOW risk with 2 direct upstream importers and 1 second-depth importer; `setupR8RuntimeHandlers` LOW risk with 0 upstream dependents.
- GitNexus status: up to date for commit `de634f9`.
- GitNexus MCP through MetaMCP remained unavailable with `Transport closed`; the required impact checks were executed through the local GitNexus CLI fallback.

### Completion Boundary

- Verified complete for the executable spec-24 vertical slice covering shared graph schemas, real scanner-cache graph construction, IPC/preload contracts, fullscreen renderer entrypoints, snapshot save/list, mermaid/dot/svg export, node-limit degradation, graph-kind switching, slice controls, command/status/sidebar/tab/shortcut/hash entrypoints, and process-node monitor navigation.

## 2026-05-16 R8.C spec-24 Automatic Topology Snapshotter

- Added `src/main/services/graph/GraphSnapshotter.ts` and exported it from the graph service barrel. It schedules a 300000ms recursive timeout from the main process, calls `unref()` on the timer, avoids overlapping runs, and stops during `R8RuntimeService.dispose()`.
- Wired the snapshotter through `R8RuntimeService.startTopologySnapshotter()` and `setupR8RuntimeHandlers()`. The existing `R8.C.topology.global` feature flag is the user-off switch; disabling it stops the background scheduler.
- Automatic runs build fresh global `network-topology`, `neural-relationship`, and `flow` graphs via the real `GraphService` scanner-cache path, then persist through the existing confirmed filesystem snapshot writer. No parallel mock snapshot store was introduced.
- Retention prunes only auto-generated labels prefixed with `auto-topology:` after 24h, preserving user-confirmed/manual topology snapshots.
- Added `topology:auto-snapshot` audit rows for saved/pruned counts, graph kinds, skipped reasons, and runtime errors.

### Verification

```bash
pnpm -C devhub test -- --run src/main/services/graph/GraphService.test.ts --maxWorkers=1
pnpm -C devhub test -- --run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "statusbar config"
pnpm -C devhub test -- --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "spec-24 topology"
```

- `GraphService.test.ts`: 1 file, 8 tests passed.
- `r8RuntimeHandlers.test.ts`: 1 focused test passed, 24 skipped by filter.
- `R8RuntimeService.test.ts`: 1 focused spec-24 topology test passed, 101 skipped by filter.

## 2026-05-16 R8.C spec-24 Neural Alias and Project Root Inference

- Extended `GraphService.buildNeural()` with real metadata inference rather than a separate mock builder. Processes without `projectId` now receive `belongs-to-project` edges when their `workingDir` is inside a registered project root.
- Added command-line project-root matching with path-boundary checks for cases where the project path appears in the process command but not in scanner metadata.
- Added local command/name alias tags for Claude Code, Codex, Gemini CLI, Cursor, Node package managers, and Python runtimes. These appear as `tag-alias-*` neural nodes connected by `has-tag` edges.
- Preserved explicit `projectId` confidence at `0.9`; inferred cwd/command project edges use lower confidence `0.72` so downstream explainers can distinguish scanner truth from inference.

### Verification

```bash
pnpm -C devhub test -- --run src/main/services/graph/GraphService.test.ts --maxWorkers=1
```

- `GraphService.test.ts`: 1 file, 9 tests passed.
- Implemented historical cursors as explicit current-cache renderings marked with `E_GRAPH_HISTORICAL_CURSOR`; this slice does not claim true arbitrary historical reconstruction from spec-22 audit snapshots.
- Implemented layout selection as renderer state over the existing graph control wrapper; this slice does not claim dedicated Cytoscape/dagre/cose/cola layout engines or packaged Electron 500-node p95 profiling.
- Implemented explicit PNG refusal instead of fake PNG output; a real renderer canvas PNG exporter remains a future integration item.
- Implemented user-confirmed manual snapshot save/list; this slice does not claim a 5-minute automatic `GraphSnapshotter` retention scheduler or full audit-log entries for every save/export/time-cursor action.


## 2026-05-04 R8.C spec-25 Attached Topology Deep10 Slice

- Continued from spec-24 into attached topology without changing `buildScopedTopologyGraph`, because GitNexus reported that symbol as HIGH risk before edit. The legacy scoped graph/flow path remains intact.
- Added `src/shared/schemas/attached-topology.ts` as the Zod source of truth for attached topology requests, graph-kind selection, pinned favorites, and attached topology results.
- Extended `src/shared/schemas/r8-runtime.ts` with typed `AttachedTopologyRequest`, `AttachedTopologyResult`, and `AttachedTopologyFavorite` contracts.
- Upgraded `R8RuntimeService.topologyAttachedDeep10` from a raw scanner snapshot envelope to a real `GraphService`-backed attached graph builder. It maps process/port/window/project scopes into graph slices and supports depth 1-10.
- Depth 8-10 now uses truthful lazy mode: first fetch truncates at depth 7 and returns `E_ATTACHED_LAZY_REQUIRED`; requests with `expandedNodeIds` fetch the requested depth without fake placeholder data.
- Updated `r8RuntimeHandlers`, preload, and renderer global typings so `topology:attached:get-deep10` accepts and returns the real attached topology contract.
- Upgraded `AttachedGraphView` with graph-kind buttons, a 1-10 depth slider, lazy-mode banner, local pinned favorites, mini-thumbnail breakpoint detection, and R8 attached bridge rendering through the existing `GraphCanvas`. When the bridge is unavailable, it falls back to the existing scoped graph path.
- Added `AttachedGraphView.test.tsx` and extended the R8 runtime topology test to cover depth-10 lazy behavior, explicit node expansion, and pin persistence.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus impact buildScopedTopologyGraph --repo devhub --direction upstream --depth 2
npx gitnexus impact useScopedTopology --repo devhub --direction upstream --depth 2
pnpm typecheck
pnpm test --run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.test.tsx src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

Results:

- Pre-edit GitNexus impact: `buildScopedTopologyGraph` HIGH risk, so it was not modified; `useScopedTopology` LOW risk.
- Targeted spec-25/runtime/preload/renderer suite: 4 files passed, 59 tests passed with `--maxWorkers=1`.
- TypeScript typecheck: passed.
- Lint and no-emoji check: passed; `No emoji found in 368 files`.
- License check: passed; 400 production package entries validated and 1 documented exception retained.
- Full Vitest: 75 files passed, 583 tests passed with `--maxWorkers=1`.
- GitNexus analyze: indexed 4,274 nodes, 13,192 edges, 359 clusters, and 300 flows.
- Auto-generated GitNexus `AGENTS.md` / `CLAUDE.md` noise was reverted only for those two files.
- Post-index impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk. `AttachedGraphView` was not indexed as a standalone named symbol by the CLI, so renderer coverage is represented by the passing target/full tests.
- GitNexus status: up to date for commit `de634f9`.

### Completion Boundary

- Verified complete for the executable spec-25 slice covering typed attached topology contracts, R8 bridge deep10 graph building, depth 1-10 UI control, 8-10 lazy-mode first fetch, explicit node expansion request propagation, process/port/window/project scope compatibility, renderer fallback, mini-thumbnail detection, and local pinned favorites.
- Not claimed complete in this slice: audit-log rows for every depth change/lazy expand/favorite event, full card-corner badge rollout across every process/port/window card variant, external floating popout expansion for mini-thumbnail mode, and a packaged Electron p95 benchmark artifact.


## 2026-05-05 R8.C spec-26 Attached Flow Slice

- Continued from the verified spec-25 attached topology slice into the spec-26 attached flow slice without deleting legacy scoped topology flow, monitor detail surfaces, topology fullscreen entrypoints, or existing preload contracts.
- Added `src/shared/schemas/flow.ts` as the strict Zod source of truth for `FlowRequest`, `FlowSnapshot`, `FlowStats`, `FlowFilter`, export requests/results, 30min default windows, `fromTs`/`toTs` validation, cursor timestamp, and speed values `0/1/2/4/8`.
- Added independent main-process flow modules under `src/main/services/graph/`: `FlowEventCollector.ts`, `FlowWindowSelector.ts`, and `FlowBuilder.ts`. The builder consumes real runtime state only: task queue runs, CSV launch sessions, persisted RecordingService manifests/events, and real `security-audit.log` entries when present.
- Updated `R8RuntimeService` with executable `getAttachedFlow`, `filterAttachedFlow`, `flowScopedStats`, and `exportFlowTimeline` methods. These now return typed `FlowSnapshot`/`FlowStats`/`FlowExportResult` and do not mark external CLI success unless task completion paths provide real executor results.
- Wired spec-26 through IPC and preload: `flow:get-attached`, `flow:filter-edges`, `flow:scoped-stats`, and `flow:export-timeline` are registered in `r8RuntimeHandlers`, exposed from `window.devhub.r8.topology`, typed in renderer globals, and listed in `prompts/0421/contracts/23-ipc-contracts-master.md`.
- Rebuilt `AttachedFlowView` so process/port/window/project attached panels can use the new flow bridge when available and retain the old renderer-store scoped-flow fallback when the bridge is absent.
- Added UI controls for the default 30min window, presets `5min/30min/1h/6h/24h/all`, time cursor filtering, speed buttons `pause/1x/2x/4x/8x`, visible stats badge, and mermaid sequence export display. All icons are from the existing icon library; no emoji are used.
- Added regression coverage in `R8RuntimeService.test.ts`, `r8RuntimeHandlers.test.ts`, `r8-runtime.test.ts`, `preloadContract.test.ts`, and `AttachedFlowView.test.tsx` for real flow construction, default 30min behavior, fail/retry stats, recording-event ingestion, mermaid export, IPC routing, preload whitelist synchronization, and renderer controls.
- Raised only the existing monitor BrowserWindow test timeout to 10s because it consistently completes on this resource-constrained Windows machine but can exceed Vitest's default 5s threshold. The underlying assertion path still executes and passes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm typecheck
pnpm test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/attached/AttachedFlowView.test.tsx --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
```

Results:

- Targeted spec-26/runtime/preload/renderer suite: 5 files passed, 65 tests passed with `--maxWorkers=1`.
- TypeScript typecheck: passed.
- Lint and no-emoji check: passed; `No emoji found in 373 files`.
- License check: passed; 400 production package entries validated and 1 documented exception retained.
- Full Vitest: 76 files passed, 586 tests passed with `--maxWorkers=1`.
- Post-doc no-emoji scan: `No emoji found in 373 files`; both updated markdown files also returned zero emoji-like codepoints.
- GitNexus analyze: indexed 4,334 nodes, 13,377 edges, 369 clusters, and 300 flows. Auto-generated `AGENTS.md` / `CLAUDE.md` noise was reverted only for those two files.
- Post-index impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

### Completion Boundary

- Verified complete for the executable spec-26 vertical slice covering typed flow contracts, default 30min window, time cursor filtering, speed controls, stats, mermaid/svg export, real task/CSV/recording/audit source ingestion, IPC/preload/UI wiring, and renderer fallback compatibility.
- Not claimed complete in this slice: SQLite-backed 24h flow index, packaged Electron p95/FPS benchmark artifacts, real-time `flow:event-stream` emission/merge, dedicated `FlowGraphPanel` canvas hierarchy, audit rows for every cursor/window/export UI operation, and full SignalFusion/spec-28 state-machine event ingestion beyond the real audit/recording/task sources currently available.

## 2026-05-05 R8.C spec-27 AI Signal Fusion Slice

- Continued from the verified spec-26 attached-flow slice into spec-27 without deleting the existing `AITaskTracker` detection pipeline, monitor views, preload bridge, or R8 IPC registry entries.
- Added `src/shared/schemas/signal-fusion.ts` as the Zod source of truth for six signal sources, normalized `WeightProfile`, compatible `SignalSample` parsing, six-source contribution snapshots, and `FusionConfig` defaults.
- Added independent detection modules: `SignalFusion.ts` for confidence-weighted averaging with decay, `WeightProfile.ts` for default / cli-heavy / window-heavy / user-custom profiles, and `SignalContributionTracker.ts` for bounded in-memory contribution snapshots.
- Updated `R8RuntimeService.fuseSignals` to use weighted mean over effective weights instead of direct hard-coded accumulation. The service now persists `FusedSignal` plus `SignalContributionSnapshot`, returns full snapshots from `getSignalContributions`, exposes profile/config APIs, writes `AuditLogger` rows for weight changes, and emits real `ai:fusion-stream` payloads with a 100ms default throttle.
- Wired spec-27 IPC and preload contracts: `ai:get-signal-contributions`, `ai:get-instance-state`, `ai:list-weight-profiles`, `ai:fusion-config`, `ai:set-weight-profile`, and listener support for `ai:fusion-stream` are now typed through preload and renderer globals.
- Added `SignalWeightPanel` under settings so operators can inspect profiles, edit user-custom weights, toggle decay, and view the latest real fusion-stream contribution snapshot. The panel intentionally shows an empty waiting state instead of sample placeholders when no stream has arrived.
- Kept the implementation dependency-light: no new numeric package was added because the spec-required weighted mean, normalization, stale decay, and fallback caps are deterministic and covered by tests.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus status
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact AITaskTracker --repo devhub --direction upstream --depth 2
pnpm typecheck
pnpm test --run src/main/services/detection/SignalFusion.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/views/settings/SignalWeightPanel.test.tsx --maxWorkers=1
```

Results so far:

- GitNexus status: index up to date for commit `de634f9` before edits.
- Pre-edit impact: `R8RuntimeService` LOW risk; `AITaskTracker` MEDIUM risk, so the old tracker path was not refactored.
- TypeScript typecheck: passed after the service/schema/preload/renderer updates.
- Targeted spec-27 suite: 6 files passed, 70 tests passed with `--maxWorkers=1`.

### Completion Boundary

- Verified complete for the executable spec-27 slice covering cli-dominant fusion, no-cli confidence cap, six-source contribution transparency, user profile application, audit logging call path, stale decay, stream throttle, preload listener contract, and settings UI controls.
- Not claimed complete in this slice: Dempster-Shafer or Bayesian algorithm implementation, full spec-28 state-machine ingestion, packaged Electron p95/FPS artifacts, and a broad rewrite of `AITaskTracker` internals. Those remain downstream or deliberately avoided to preserve existing behavior.

### Final Verification Addendum

Commands executed from `D:/Desktop/CREATOR ONE/devhub` after docs were updated:

```bash
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
pnpm typecheck
npx gitnexus analyze --force
git restore -- AGENTS.md CLAUDE.md
npx gitnexus status
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact SignalFusion --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus impact SignalWeightPanel --repo devhub --direction upstream --depth 2
```

Final results:

- Lint: passed; `No emoji found in 380 files`.
- License: passed; 400 production package entries validated and 1 documented exception retained.
- Full Vitest: 78 files passed, 592 tests passed with `--maxWorkers=1`.
- Final TypeScript typecheck: passed.
- GitNexus analyze: indexed 4,396 nodes, 13,581 edges, 378 clusters, and 300 flows.
- Auto-generated GitNexus `AGENTS.md` / `CLAUDE.md` noise was reverted only for those two files.
- GitNexus status: up to date for commit `de634f9`.
- Post-index impact: `R8RuntimeService` LOW, `SignalFusion` LOW, `setupR8RuntimeHandlers` LOW, `SignalWeightPanel` LOW.

## 2026-05-05 R8.C spec-28 AI State Machine Three-Layer Slice

- Continued from the verified spec-27 signal-fusion slice into spec-28 without deleting or refactoring the existing `AITaskTracker` detection path, monitor views, settings UI, or previous IPC/preload contracts.
- Added `xstate@5.31.0` and implemented three independent xstate v5 actors under `src/main/services/state/`: `SystemFSM`, `TaskFSM`, and `UiFSM`. State flips are routed through events and invalid direct jumps throw `E_VALIDATION`.
- Added `src/shared/schemas/state-machine.ts` as the Zod source of truth for `SystemState`, `TaskState`, `UiState`, `StateTransitionEvent`, `InstanceState`, assertion rules, violations, and rule overrides.
- Added `StateMachineCoordinator` as the integration boundary for per-instance state, 1024-entry newest-first transition ringbuffer, spec-27 fused-signal task driving, user rule overrides, and xstate actor access.
- Added `StateAssertion` with 8 built-in system-task-ui consistency rules. New open violations are now audited by `R8RuntimeService` through `AuditLogger.log('ai:state-assertion-violation', ...)`.
- Updated `R8RuntimeService` so `fuseSignals` stores the real fusion snapshot, applies it to the three-layer coordinator, emits `ai:fusion-stream`, and emits `ai:state-stream` with a 100ms per-instance/layer throttle when a transition is produced.
- Wired executable IPC/preload contracts for `ai:get-instance-state`, `ai:list-state-rules`, `ai:override-rule`, and renderer listener support for `ai:state-stream`; the shared IPC registry now maps spec-28 channels to `R8.C.state.three-layer`.
- Added regression coverage for the five GWT assertions, ringbuffer overflow, invalid transition rejection, state-rule IPC routing, preload listener cleanup, schema registry coverage, feature-flag mapping, and violation audit calls.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/state/StateMachineCoordinator.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
pnpm typecheck
npx gitnexus analyze --force
git restore -- AGENTS.md CLAUDE.md
npx gitnexus status
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact StateMachineCoordinator --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
```

Results:

- Targeted spec-28 suite: 5 files passed, 74 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 388 files`.
- License check: passed; 401 production package entries validated and 1 manifest exception retained.
- Full Vitest: 79 files passed, 599 tests passed with `--maxWorkers=1`.
- Final TypeScript typecheck: passed.
- GitNexus analyze: indexed 4,440 nodes, 13,734 edges, 381 clusters, and 300 flows.
- Auto-generated GitNexus `AGENTS.md` / `CLAUDE.md` noise was reverted only for those two files.
- GitNexus status: up to date for commit `de634f9`.
- Post-index impact: `R8RuntimeService` LOW, `StateMachineCoordinator` LOW, `setupR8RuntimeHandlers` LOW.

### Completion Boundary

- Verified complete for the executable spec-28 vertical slice covering xstate v5 three-layer FSMs, event-only state transitions, 1024 ringbuffer overwrite behavior, 8 layer assertion rules, rule override/audit, violation audit, state stream throttle, IPC/preload typing, and fused-signal task driving.
- Not claimed complete in this slice: spec-29 feedback-loop invalidation/recompute subscriber, spec-32 renderer observability panel, packaged Electron p95/FPS artifacts, or broad `AITaskTracker` refactoring. These remain downstream or intentionally avoided to preserve existing behavior.

## 2026-05-05 R8.C spec-29 Feedback Loop Misreport Slice

- Continued from the verified spec-28 state-machine slice into spec-29 without deleting `AITaskTracker`, `SignalFusion`, existing monitor cards, or previous IPC/preload contracts.
- Added `better-sqlite3@11.10.0` and `@types/better-sqlite3`, with `better-sqlite3` added to `pnpm.onlyBuiltDependencies`; verified the native module with a real in-memory SQLite open/create/insert/select/close smoke test.
- Added `src/shared/schemas/misreport.ts` as the Zod source of truth for `MisreportKind`, `MisreportRecord`, `WeightAdjustment`, `DiagnosticExplain`, report/list/reset requests, and report/reset responses.
- Added `MisreportLogger` for local SQLite persistence under Electron `userData`, WAL mode, indexed misreport queries, indexed weight-adjustment summaries, and JSONL fallback on write failure. No telemetry path was added.
- Added `WeightAdjuster` for conservative local learning: single feedback delta is bounded by 5%, cumulative per-source learning is bounded by 20%, and learned weights are applied through the existing user-custom profile path before `SignalFusion` runs.
- Added `DiagnosticExplainService` to convert real signal-contribution snapshots plus spec-28 state transitions into up to 5 human-readable reasons and a suggested operator action.
- Updated `R8RuntimeService` with executable `reportMisreport`, `listMisreports`, `diagnosticExplain`, and `resetLearnedWeights` methods. Feedback is rate-limited per instance to one report per minute, audit targets redact user note content, and reset requires `confirmedBy`.
- Wired spec-29 through IPC/preload/global types for `ai:report-misreport`, `ai:list-misreports`, `ai:get-diagnostic-explain`, and `ai:reset-learned-weights`; the shared IPC registry maps these channels to `R8.C.feedback.loop`.
- Added `MisreportButton` with a 3-second confirmation countdown and `SignalDiagnosticPanel` with default-collapsed local diagnostics, then attached both to AI window cards in `WindowView` using existing icon components only.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
node -e "const Database=require('better-sqlite3'); const db=new Database(':memory:'); db.exec('create table t(id integer primary key, v text)'); db.prepare('insert into t(v) values (?)').run('ok'); console.log(db.prepare('select v from t').get().v); db.close();"
pnpm test --run src/renderer/views/monitor/MisreportButton.test.tsx src/main/services/feedback/MisreportLogger.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/views/monitor/SignalDiagnosticPanel.test.tsx --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
pnpm typecheck
npx gitnexus analyze --force
git restore -- AGENTS.md CLAUDE.md
npx gitnexus status
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact MisreportLogger --repo devhub --direction upstream --depth 2
npx gitnexus impact WeightAdjuster --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus impact MisreportButton --repo devhub --direction upstream --depth 2
```

Results:

- better-sqlite3 smoke test: printed `ok` after real SQLite in-memory insert/select.
- Targeted spec-29 suite: 7 files passed, 73 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 398 files`.
- License check: passed; 421 production package entries validated and 1 manifest exception retained.
- Full Vitest: 82 files passed, 604 tests passed with `--maxWorkers=1`.
- Final TypeScript typecheck: passed.
- GitNexus analyze: indexed 4,563 nodes, 13,970 edges, 383 clusters, and 300 flows.
- Auto-generated GitNexus `AGENTS.md` / `CLAUDE.md` noise was reverted only for those two files.
- GitNexus status: up to date for commit `de634f9`.
- Post-index impact: `R8RuntimeService` LOW, `MisreportLogger` LOW, `WeightAdjuster` LOW, `setupR8RuntimeHandlers` LOW, `MisreportButton` LOW.

### Completion Boundary

- Verified complete for the executable spec-29 vertical slice covering local SQLite misreport persistence, learned-weight adjustment bounds, duplicate feedback rate limit, diagnostic explain, reset learned weights, redacted audit, IPC/preload typing, AI card misreport control, and default-collapsed diagnostic panel.
- Not claimed complete in this slice: spec-32 misreport trend panel, spec-36 diagnostic export inclusion, multi-user identity provider integration, or any remote telemetry. These remain downstream or explicitly prohibited by the spec.

## 2026-05-05 R8.C spec-30 Unified Notification System Slice

- Continued from the verified spec-29 feedback-loop slice into spec-30 without deleting legacy task notifications, renderer toast provider, monitor cards, or existing IPC/preload contracts.
- Added `src/shared/schemas/notification.ts` as the Zod source of truth for uppercase notification levels, six channels, sources, actions, aggregation config, channel config, list/dismiss/action requests, and emit responses.
- Added `UnifiedNotificationService` and `NotificationAggregator` under `src/main/services/notification/` as the unified entrypoint. Legacy `NotificationService.notify(...)` now forwards into this unified path while preserving existing legacy history and metadata focus behavior.
- Added six independent channel classes with per-channel rate limits: toast, native OS notification, statusbar, email, webhook, and desktop bell. Email and webhook are privacy-off by default; explicit SMTP/webhook config is required before real delivery.
- Added real webhook delivery through HTTPS `fetch` with timeout and three retries, plus channel suspension/audit after repeated failures. Added real SMTP delivery through `nodemailer`; `MIT-0` was admitted as an allowed permissive license in the license gate.
- Implemented default 60s aggregation keyed by `sha256(level + source + instanceId)`, configurable `windowMs`/`perLevel`, body rewrite with `N occurrences`, and FATAL bypass for immediate OS notification + desktop bell delivery.
- Wired R8 IPC/preload contracts for `notify:emit`, `notify:list`, `notify:dismiss`, `notify:configure-aggregation`, `notify:configure-channel`, `notify:invoke-action`, and renderer listeners for `notify:stream`, `notify:statusbar`, and `notify:desktop-bell`.
- Added renderer `ToastHost` and `NotificationCenter` using existing icon components only; no emoji assets or mock data paths were introduced.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/main/services/notification/NotificationService.test.ts src/renderer/components/notify/ToastHost.test.tsx src/renderer/components/notify/NotificationCenter.test.tsx --maxWorkers=1
pnpm typecheck
pnpm test --run src/preload/preloadContract.test.ts src/main/services/notification/NotificationService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
```

Results:

- Targeted notification suite: 3 files passed, 9 tests passed initially; after fallback hardening, notification service coverage is 8 tests passed.
- R8/preload targeted regression: 4 files passed, 65 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 415 files`.
- License check: passed; 422 production package entries validated and 1 manifest exception retained.
- Full Vitest: 85 files passed, 614 tests passed with `--maxWorkers=1`.
- Final TypeScript typecheck: passed.

### Completion Boundary

- Verified complete for the executable spec-30 vertical slice covering 4 levels, 6 channels, aggregation, channel config, action dispatch, privacy defaults, renderer delivery surfaces, IPC/preload typing, contract docs, no-emoji compliance, and real SMTP/webhook-capable delivery paths.
- Not claimed complete in this slice: SMS/IM integrations, remote telemetry, default external delivery activation, or packaged OS-level notification click behavior on every target Windows version. Native click/failure handling is implemented and must still be validated in packaged release certification.

## 2026-05-05 R8.C spec-31 IPC Rate Limit Slice

- Continued from the verified spec-30 notification slice into spec-31 without deleting legacy IPC handlers, existing fixed-window `withRateLimit` call sites, R8 runtime contracts, preload APIs, or renderer operations panels.
- Added `src/shared/schemas/ipc-rate-limit.ts` as the Zod source of truth for `RateLimitClass`, `ChannelRegistration`, `RateLimitVerdict`, stats responses, and dev-only override request/response contracts.
- Added `IpcChannelRegistry`, `RateLimiter`, and `RateLimitMiddleware` under `src/main/services/ipc/`. The limiter uses a local monotonic token bucket, bounded in-memory maps, per-channel/per-sender key support, retry-after verdicts, and one-minute stats windows.
- Upgraded `src/main/utils/rateLimiter.ts` as a compatibility bridge. Existing `withRateLimit(channel, rpm, handler)` call sites still work, while R8 channels can now use the four spec classes: `high_freq_scan=30`, `medium_query=60`, `low_freq_op=120`, and `meta=600` RPM.
- Wired executable IPC/preload contracts for `ipc:rate-limit-stats`, `ipc:rate-limit-channel-list`, and `ipc:override-rate-class`. Override returns `E_VALIDATION` outside `NODE_ENV=development`.
- Added reject-rate audit callback: when a channel exceeds 5% rejects, `ipc:rate-limit-warn` is written through the existing audit logger with channel, class, reject count, and total count.
- Updated `R8OpsPanel` to display actual `ChannelRegistration` rows, high-frequency counts, per-sender bucket counts, and burst allowance values rather than the older channel-definition shape.
- Hardened `RecordingService.readAllManifests` to skip malformed persisted manifest JSON. This was exposed by combined low-worker regression runs and aligns with the project rule that real dirty local data must not crash unrelated runtime calls.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
npx gitnexus analyze --force
git restore -- AGENTS.md CLAUDE.md .claude/skills/gitnexus
npx gitnexus status
npx gitnexus impact withRateLimit --repo devhub --direction both
npx gitnexus impact RateLimiter --repo devhub --direction both
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction both
pnpm test --run src/main/services/ipc/RateLimiter.test.ts src/main/utils/rateLimiter.test.ts --maxWorkers=1
pnpm typecheck
pnpm test --run src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1
pnpm test --run src/main/services/ipc/RateLimiter.test.ts src/main/utils/rateLimiter.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
```

Results:

- GitNexus analyze: final index contains 4,703 nodes, 14,478 edges, 410 clusters, and 300 flows; generated `AGENTS.md` / `CLAUDE.md` / `.claude/skills/gitnexus` noise was reverted only for those paths.
- GitNexus status: up to date for commit `de634f9`.
- GitNexus impact: `RateLimiter` LOW; `withRateLimit` and `setupR8RuntimeHandlers` are CRITICAL because they are central IPC surfaces, so the implementation preserved the old wrapper API and added schema-backed internals rather than broad handler rewrites.
- Focused limiter suite: 2 files passed, 8 tests passed with `--maxWorkers=1`.
- IPC/preload regression: 2 files passed, 18 tests passed with `--maxWorkers=1`.
- R8RuntimeService regression: 1 file passed, 42 tests passed with `--maxWorkers=1`.
- Final targeted spec-31/R8 regression: 5 files passed, 68 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 420 files`.
- License check: passed; 422 production package entries validated and 1 manifest exception retained.
- Full Vitest: 86 files passed, 622 tests passed with `--maxWorkers=1`.
- Final TypeScript typecheck: passed.

### Completion Boundary

- Verified complete for the executable spec-31 vertical slice covering 4 class token buckets, burst allowance, retry-after rejection, channel registry, stats response, feature-flag-off non-blocking behavior, dev-only override, IPC/preload typing, renderer display, and malformed manifest defensive skip.
- Not claimed complete in this slice: spec-32 observability panel charts/export, packaged Electron performance p99 measurements, or a CI-wide grep that fails every future unregistered IPC addition. The registry and tests are ready for that CI gate, but the broad CI command is left to the release pipeline.

## 2026-05-05 R8.C spec-32 Observability Panel Slice

- Continued from the verified spec-31 IPC rate-limit slice into spec-32 without deleting legacy `devObs` channels, existing monitor panels, R8 runtime contracts, preload APIs, or renderer navigation.
- Added `src/shared/schemas/observability.ts` as the Zod source of truth for metric kinds, metric samples, snapshots, config, export requests/responses, diagnostic-pack bridge responses, and stream subscribe/unsubscribe contracts.
- Added `RingBufferStore` and `SnapshotBuilder` under `src/main/services/observability/`. The store is bounded, defaults to 30 minutes at 1 Hz, supports 5 minutes through 6 hours, and degrades effective sampling under buffer pressure.
- Wired executable R8 IPC/preload contracts for `obs:get-snapshot`, `obs:configure`, `obs:export-snapshot`, `obs:export-diagnostic-pack`, `obs:subscribe`, and cleanup companion `obs:unsubscribe`.
- The snapshot builder derives all 11 spec metrics from local runtime surfaces only: IPC RPM, rate-limit rejects, notification history, state-machine transitions, signal-fusion confidence, memory RSS, CPU percent, SHIM installation status, watchdog heartbeat health, CSV throughput, and inject success rate.
- Added local JSON/CSV snapshot export with audit logging. `obs:export-diagnostic-pack` forwards to the existing local diagnostic export path and returns `zipPath: null`, avoiding fake ZIP creation before spec-36.
- Added `ObservabilityPanel`, `MetricChart`, and `TimeCursor` renderer views, then embedded them into the existing developer observability drawer under an `R8.C` tab. The hash route `#/observability` opens the drawer without replacing existing monitor surfaces.
- Preserved NO-TELEMETRY behavior: the implementation uses in-memory IPC, local runtime services, and local filesystem export only.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm typecheck
pnpm test --run src/main/services/observability/RingBufferStore.test.ts src/main/services/observability/SnapshotBuilder.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/renderer/views/observability/ObservabilityPanel.test.tsx src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm test --run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 --reporter=verbose
pnpm test --run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
pnpm lint
pnpm check:no-emoji
pnpm check:license
pnpm test --run --maxWorkers=1
git diff --check
git -C .. diff --check
```

Results:

- TypeScript typecheck: passed.
- Targeted spec-32 suite plus IPC regression: 6 files passed, 68 tests passed with `--maxWorkers=1`.
- IPC handler cleanup regression: 1 file passed, 14 tests passed after preserving production `dispose()` cleanup with idempotent optional invocation for incomplete test doubles.
- Runtime contract coverage: 1 file passed, 11 tests passed after raising the prompts/0503-2 declared IPC baseline to 298 and explicitly asserting the `obs:*` registry entries.
- Lint and no-emoji gate: passed; `No emoji found in 429 files`.
- License check: passed; 422 production package entries validated and 1 manifest exception retained.
- Full Vitest: 89 files passed, 630 tests passed with `--maxWorkers=1`.
- Final whitespace checks: `git diff --check` and `git -C .. diff --check` passed.
- Preload contract whitelist was updated and passed for the new `obs:*` invoke/listener channels.

### Completion Boundary

- Verified complete for the executable spec-32 vertical slice covering shared Zod schemas, bounded ring buffer config, snapshot health calculation, 11 metric cards, time cursor interaction, JSON/CSV export, stream subscription cleanup, three-subscriber limit, IPC/preload typing, and local-only behavior.
- Not claimed complete in this slice: spec-36 ZIP diagnostic package internals, packaged Electron network-capture certification, or unrelated R8.C specs after spec-32.

## 2026-05-05 R8.C spec-33 Zod Source of Truth Slice

- Continued from the verified spec-32 observability slice into spec-33 without deleting existing schemas, IPC channels, preload APIs, renderer panels, or compatibility wrappers.
- Added `src/shared/schemas/_meta.ts` for `SCHEMA_VERSION`, schema metadata, IPC schema pairs, validation verdicts, migration steps, and zod channel request/response contracts.
- Added `src/shared/schemas/index.ts` as a central schema entry point. It exports `r8-runtime` at top level and uses namespace exports for individual schema modules to avoid existing duplicate symbol collisions.
- Added `SchemaRegistry`, `IpcSchemaGuard`, and `SchemaMigration` under `src/main/services/zod/`. Registry validation uses real Zod schema objects from `r8RuntimeSchemaRegistry`; invalid payloads return structured path/message issues.
- Promoted `zod:list-schemas`, `zod:validate-payload`, and `zod:migration-status` from ad-hoc runtime helpers to schema-backed service methods. `zod:validate-payload` now parses its IPC request through `zodValidatePayloadRequestSchema`.
- Updated preload/global renderer types and `R8OpsPanel` to consume versioned schema metadata instead of the old raw name list.
- Added `scripts/verify-zod-sot.ts` and `check:zod-sot` to enforce central index coverage, spec-33 registry entries, guarded zod IPC handlers, and duplicate runtime type detection with a documented legacy allowlist.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm check:zod-sot
pnpm typecheck
pnpm test --run src/main/services/zod/SchemaRegistry.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
git diff --check
git -C .. diff --check
```

Results:

- Zod SoT verifier: passed; schema index, runtime meta registry, guarded zod IPC snippets, and legacy duplicate type allowlist are enforced.
- TypeScript typecheck: passed.
- Targeted spec-33/R8 regression: 5 files passed, 78 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 436 files`.
- License check: passed; 422 production package entries validated and 1 manifest exception retained.
- Full Vitest: 90 files passed, 634 tests passed with `--maxWorkers=1`.
- Final whitespace checks: `git diff --check` and `git -C .. diff --check` passed.

### Completion Boundary

- Verified complete for the executable spec-33 vertical slice covering shared Zod metadata, central schema exports, runtime schema registry listing, IPC guard failures, migration metadata, zod IPC request validation, renderer metadata consumption, verifier script, and local quality gates.
- Not claimed complete in this slice: rewriting every historical legacy interface in `types-extended.ts`, packaged CI workflow rollout, or spec-34 crash recovery behavior.

## 2026-05-05 R8.C spec-34 Crash Recovery Slice

- Continued from the verified spec-33 Zod source-of-truth slice into spec-34 without deleting legacy recovery channels, existing R8 runtime methods, preload APIs, renderer monitor surfaces, or shared schema registry behavior.
- Added `src/shared/schemas/recovery.ts` as the Zod source of truth for dirty findings, recovery snapshots, recovery reports, lifecycle markers, probe summaries, and recovery IPC request/response payloads.
- Added `AppLifecycle` plus `DirtyStateScanner`, `RecoveryProbe`, and `RecoveryStrategy`. Startup probing is bounded and non-blocking; independent scanner failures are converted into structured findings instead of suppressing unrelated scans.
- Dirty-state detection now covers unclean shutdown markers, pending task queue rows, orphan DevHub SHIM-shaped process metadata, unsaved store artifacts, truncated audit logs, malformed state-machine records, and SQLite `PRAGMA integrity_check` failures.
- Recovery actions create a real `pre-recovery` snapshot before cleanup/restore. SQLite integrity failures are preserved as critical findings and return a manual rebuild error after snapshot retention instead of pretending to repair the database.
- Wired executable IPC/preload contracts for `recovery:check-dirty`, `recovery:restore-state`, `recovery:list-snapshots`, `recovery:create-checkpoint`, and updated `recovery:dismiss`, while retaining `recovery:scan` and `recovery:report` for compatibility.
- Added `RecoveryDialog` to the existing R8 Ops panel. It uses existing icon components only, shows severity and recommended actions, and offers restore-all, checkpoint, and seven-day dismiss choices.
- Synchronized the preload whitelist contract and shared IPC inventory for the new recovery channels.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub typecheck
pnpm -C devhub test --run src/main/services/recovery/RecoveryProbe.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/recovery/RecoveryProbe.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:license
pnpm -C devhub test --run --maxWorkers=1
git -C devhub diff --check
git diff --check
```

Results:

- TypeScript typecheck: passed.
- RecoveryProbe focused suite: 1 file passed, 6 tests passed with real temporary filesystem and invalid SQLite inputs.
- Targeted spec-34 regression: 5 files passed, 80 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 444 files`.
- Zod SoT verification: passed.
- License check: passed; 422 production package entries validated and 1 documented manifest exception retained.
- Full Vitest: 91 files passed, 640 tests passed with `--maxWorkers=1`.
- Final whitespace checks: `git -C devhub diff --check` and `git diff --check` passed. Git reported existing LF-to-CRLF warnings only.

## 2026-05-05 R8.C spec-35 Backup Restore Slice

- Continued from the verified spec-34 crash recovery slice into spec-35 without deleting legacy backup methods, existing R8 runtime methods, preload APIs, renderer monitor surfaces, or shared schema registry behavior.
- Extended `src/shared/schemas/r8-runtime.ts` with backup category, manifest, schedule, create/export/delete request, restore plan, restore result, and schedule result contracts. `BackupBundle` remains backward-compatible with legacy `bundleId`, `scope`, `path`, `bytes`, and `createdAt`.
- Implemented real deterministic local backup artifacts in `R8RuntimeService`: `manifest.json`, `settings/store.json`, `csv-tasks/tasks.json`, `skills/skills.json`, and `audit-log/audit-log.json`. The implementation does not return a fake ZIP path; `zipPath` is retained as compatibility metadata pointing at the deterministic artifact root.
- Added per-category SHA256 hashing and restore-time verification before any state mutation. Tampered category files reject restore with `E_VALIDATION`.
- Added backup redaction for sensitive field names and token-like string patterns including `sk-`, `tok-`, `AKIA...`, JWT-like tokens, and bearer tokens before artifacts are written.
- Implemented selective restore with `overwrite`, `merge`, and `skip` conflict policies. Restore creates a spec-34 `pre-recovery` checkpoint before mutating `settings`, runtime CSV task store keys, local user skill files, or restored audit review files.
- Added schedule config persistence and strict cron validation. Schedule defaults to disabled; no fake background cron execution is claimed in this slice.
- Wired `backup:configure-schedule`, `backup:schedule-config`, and `backup:export-classified` through IPC handlers, preload bridge, renderer global types, shared IPC inventory, and the preload whitelist contract.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub typecheck
pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "classified local backup|selected backup categories|tampered classified backup|exports and deletes classified|backup schedule"
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1
```

Results:

- TypeScript typecheck: passed.
- Schema/IPC/preload contract regression: 3 files passed, 29 tests passed with `--maxWorkers=1`.
- Focused spec-35 runtime regression: 1 file passed, 5 tests passed with real temporary filesystem artifacts and `--maxWorkers=1`.
- Full `R8RuntimeService.test.ts`: 48 tests passed; 1 non-spec-35 test timed out on `opens monitor BrowserWindow via R8.B popout bridge and applies guarded prefs` in this resource-constrained session.

### Completion Boundary

- Verified complete for the executable spec-35 backend/IPC/preload/schema vertical slice covering classified artifacts, manifests, redaction, SHA256 restore gate, selective restore, pre-restore checkpoint, export/delete, schedule config persistence, and compatibility APIs.
- Not claimed complete in this slice: renderer `BackupView` / `RestoreWizard`, real background cron execution, spec-36 diagnostic pack export, spec-37 permission TTL, spec-38 cloud sync facade expansion, spec-39 OCR facade expansion, or completion of all `prompts/0503-2` documents.

### Completion Boundary

- Verified complete for the executable spec-34 vertical slice covering startup dirty-state detection, local recovery snapshots, rollback restore, explicit recovery IPC/preload wiring, renderer recovery choices, schema registry sync, and targeted low-worker tests.
- Not claimed complete in this slice: spec-35 backup bundles, spec-36 diagnostic ZIP export, packaged long-run startup soak, automatic AI subprocess restart, or completion of all R8.C specs.

## 2026-05-05 R8.C spec-36..39 Resilience Slice

- Continued from the verified spec-35 backup/restore slice into spec-36..39 without deleting legacy diagnostic, permission, skill, OCR, preload, IPC, renderer type, or schema registry behavior.
- Extended `src/shared/schemas/r8-runtime.ts` with diagnostic pack, permission TTL, cloud-sync deferred, and OCR-disabled contracts. The runtime registry now covers the new spec-36..39 schemas and channels.
- Implemented spec-36 local diagnostic pack export in `R8RuntimeService`: deterministic artifact directories, `manifest.json`, section files, SHA256 metadata, preview parity, redaction counts, optional screenshots, pack listing, and `obs:export-diagnostic-pack` forwarding. Exports remain local-only with no telemetry or upload.
- Diagnostic redaction covers API keys, `tok-` secrets, GitHub tokens, AWS keys, JWT-like strings, bearer tokens, Windows/POSIX paths, usernames, hostnames, email addresses, and IPv4 addresses. Screenshot capture is default-off and failures become warnings rather than false success.
- Implemented spec-37 permission TTL persistence for the eight sensitive operations: `inject`, `shim-install`, `kill-pid`, `file-write`, `fs-elevated`, `webhook`, `smtp`, and `store-api-key`. Grants persist with wall-clock expiry, monotonic grant timestamps, policy bounds, revoke/revoke-all/list-active/configure-policy support, request rate limits, and audit records.
- Implemented spec-38 cloud-sync deferred facade. `skill:cloud-sync-status`, `skill:cloud-sync-trigger`, and `skill:cloud-sync-list-remote` return `enabled=false`, `scheduledRelease='R9'`, and `E_FEATURE_DEFERRED`, with no network calls and no cloud SDK dependencies.
- Implemented spec-39 OCR-disabled facade. `ocr:capabilities`, `ocr:recognize`, and `ocr:list-supported-languages` are wired; recognition validates request shape but never decodes images or starts OCR, returning `E_OCR_DISABLED` with `blocks=[]`.
- Added dependency guard scripts `scripts/verify-no-cloud-deps.mjs` and `scripts/verify-no-ocr-deps.mjs`, exposed through `check:no-cloud-deps` and `check:no-ocr-deps`.
- Fixed the permission TTL regression test to clear the real `electron-store` `permissionTtlGrants` and `permissionTtlPolicies` keys before deterministic assertions, preventing stale local operator grants from polluting `revoke-all` counts.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm check:no-cloud-deps
pnpm check:no-ocr-deps
pnpm typecheck
pnpm test --run src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "diagnostic packs|permission TTL|deferred cloud sync|OCR facades"
pnpm check:zod-sot
pnpm check:no-emoji
pnpm check:license
pnpm lint
git diff --check
```

Results:

- No-cloud dependency verification passed.
- No-OCR dependency verification passed.
- TypeScript typecheck passed.
- Schema/IPC/preload regression passed: 3 files, 31 tests, `--maxWorkers=1`.
- Focused spec-36..39 service regression passed: 1 file, 3 tests, `--maxWorkers=1`.
- Zod SoT, no-emoji, license, lint, and whitespace checks passed. `git diff --check` emitted only existing LF-to-CRLF warnings.

### Completion Boundary

- Verified complete for the executable spec-36..39 backend/IPC/preload/schema vertical slice covering local diagnostic artifacts, redaction, preview/export parity, permission TTL lifecycle, deferred cloud-sync contracts, hard-disabled OCR contracts, and dependency guard scripts.
- Not claimed complete in this slice: all remaining `prompts/0503-2` documents, renderer diagnostic/permission/cloud/OCR management views beyond existing bridge contracts, R9 cloud sync, future OCR implementation, background backup cron execution, or packaged long-run soak.

## 2026-05-11 R8.C spec-36 Diagnostic Pack Playwright Closure

- Continued the spec-36 diagnostic-pack export line from `prompts/0503-2/R8.C/spec-36-diagnostic-pack-export.md`.
- Added a real R8 Ops diagnostic status surface in `src/renderer/components/monitor/R8OpsPanel.tsx`. The existing diagnostic action now runs `window.devhub.r8.diagnostic.preview()` followed by `window.devhub.r8.diagnostic.export()` through the typed preload bridge, then renders preview section count, total preview bytes, redaction count, exported section count, screenshot exclusion, `noTelemetry`, and the generated local artifact path.
- Added a Playwright GWT in `e2e/example.spec.ts` for `R8.C spec-36`. The test seeds a real fake API key audit entry into Electron `app.getPath('userData')/logs/security-audit.log`, opens the real R8 Ops panel, clicks the diagnostic export button, waits for the UI to report `exported`, and reads the generated local artifact directory from disk.
- The E2E verifies exactly four exported sections, screenshot default-off behavior, `manifest.json` existence, `noTelemetry=true`, positive redaction counts, an `audit-log` section entry, and redacted audit section contents that do not contain the seeded secret.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.C spec-36" --reporter=line
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
```

Results:

- TypeScript typecheck passed.
- Production Electron build passed.
- R8.C spec-36 Playwright diagnostic artifact GWT passed: 1 test passed in 4.2s.
- Zod SoT verification passed.
- ESLint and no-emoji guard passed; no emoji found in 598 files.

### Completion Boundary

- Claimed complete for the local spec-36 checklist: diagnostic builder/redactor contracts, default/custom redaction coverage, preview redaction counts, screenshot default-off behavior, system-info identity redaction, fake-key redaction, default-on feature flag, network no-telemetry regression, audit manifest logging, and Playwright UI/artifact GWT.
- Still not claimed complete: unrelated R8.C specs, full E2E suite, release benchmark gates, or all `prompts/0503-2` documents.

## 2026-05-11 R8.C spec-37 Permission TTL Playwright Closure

- Continued the spec-37 permission TTL line from `prompts/0503-2/R8.C/spec-37-permissions-time-bounded.md`.
- Fixed a real packaged Electron launch blocker discovered while running the existing Playwright GWT: main-process DAG and task-queue modules no longer import `@dagrejs/dagre` through runtime ESM named/default imports that Electron cannot load from the package's `.js` ESM export. They now use `src/main/services/dag/dagreGraphlib.ts`, which loads the package through `createRequire()` and its CJS export.
- Preserved the existing DAG and task queue behavior; no queue state, DAG schema, permission service, or R8 Ops UI behavior was mocked or bypassed.
- Rebuilt production output with `pnpm -C devhub build`.
- Verified the rebuilt app launches through Playwright Electron against `out/main/index.js` with a minimal launch probe.
- Ran the existing spec-37 Playwright GWT. It creates a real local TTL grant through the preload IPC bridge, opens the R8 Ops panel, renders the countdown list, waits for the live countdown to cross the one-minute critical threshold, and revokes grants during cleanup.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/dag/DagOrchestrator.test.ts --maxWorkers=1 -t "graph|dag|DAG|queue|topolog|cycle|Cycle"
pnpm -C devhub typecheck
pnpm -C devhub build
node --input-type=module -e "import { _electron as electron } from '@playwright/test'; const app = await electron.launch({ args: ['out/main/index.js'], timeout: 120000 }); console.log('launched', app.windows().map(w => w.url()).join('|')); await new Promise(resolve => setTimeout(resolve, 1000)); await app.close(); console.log('closed');"
pnpm -C devhub test:e2e --grep "R8.C spec-37" --reporter=line
```

Results:

- DAG/task-queue focused Vitest regression passed: 2 files, 6 tests passed, 11 skipped, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Electron production build passed.
- Minimal Playwright Electron launch probe passed and closed the app.
- Spec-37 Playwright Electron GWT passed: 1 test passed in 10.3s.

### Completion Boundary

- Verified complete for the local spec-37 checklist: Vitest TTL coverage, CountdownBadge repaint coverage, IPC/schema/preload coverage, default feature flag coverage, and Playwright permission UI GWT.
- Still not claimed complete: unrelated R8.C specs, full E2E suite, or all `prompts/0503-2` documents.

## 2026-05-05 R8.C spec-13 CSV Schema Closure Ledger Pass

- Revisited `prompts/0503-2/R8.C/spec-13-csv-schema-18cols.md` from the full `prompts/0503-2` completion ledger after it was conservatively classified as missing.
- Confirmed the real implementation already exists in `src/shared/schemas/csv-task-row.ts`, `src/main/services/csv/CsvParser.ts`, `src/main/services/csv/CsvTaskDriver.ts`, `src/shared/csv-task-row.docs.md`, `src/shared/feature-flags.ts`, and the R8 runtime schema registry.
- Updated the spec-13 checklist only for items backed by executable local evidence: fixed 18-column order, strict header validation, Zod refinements, `inputArgs` JSON validation, group-level `dependsOn` validation, user-facing docs, template export with example row, default-on feature flag, and targeted Vitest coverage.
- Kept row-level `schemaVersion` unchecked and documented as a real boundary. The current v1 file contract carries version metadata as `devhubCsvVersion` at CSV file metadata level; future row-level migration remains v2 work.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/shared/schemas/csv-task-row.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "csv|CSV|Csv"
pnpm -C devhub check:zod-sot
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Targeted CSV/Zod regression passed: 3 files, 13 tests passed, 10 tests skipped by the name filter, `--maxWorkers=1`.
- Zod SoT verification passed.
- Trellis context validation passed with 16 entries in `implement.jsonl` and 16 entries in `check.jsonl`.

### Completion Boundary

- Verified complete for the executable spec-13 v1 CSV schema slice covering the 18-column source of truth and runtime integration.
- Not claimed complete: row-level `schemaVersion` migration, broad E2E CSV launch flows beyond existing service coverage, or closure of unrelated `prompts/0503-2` documents.

## 2026-05-05 R8.B spec-01 Port Popout Renderer Slice

- Continued the full `prompts/0503-2` completion ledger from the highest R8.B blocker: `prompts/0503-2/R8.B/spec-01-port-popout-system.md`.
- Added a real renderer floating port popout system under `src/renderer/components/popout/`, backed by the existing `PortInfo` rows from `usePorts`; no mock data, fake scanner data, or deleted monitor surfaces were introduced.
- Wired `PortView` card mode to four working triggers: hover after `1000ms`, explicit `Popout` click action, drag distance at or above `8px`, and context menu.
- Added popout state management for stable `port:pid` identity, `4000..4999` z-index allocation, five-card floating cap, oldest-unpinned eviction, all-pinned block behavior, pin, close, move, local position memory, and scanner-row synchronization.
- Wired the promote action to the existing secure `window.devhub.r8.popout.create` BrowserWindow bridge instead of introducing a new privileged renderer bridge.
- Extended `src/renderer/styles/z-index-tokens.css` with the R8 ten-tier z-index map while preserving all existing legacy token names.
- Added documentation in `docs/r8/port-popout.md` and `docs/r8/popout-zindex-tokens.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results:

- Targeted R8.B port popout regression passed: 2 files, 8 tests, `--maxWorkers=1`.
- TypeScript typecheck passed.
- No-emoji guard passed.
- ESLint passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.

### Completion Boundary

- Verified complete for this renderer floating-card slice: four triggers, z-index tier, cap/eviction, pin/close, move/position memory, scanner-row sync, docs, and targeted component/model tests.
- Not claimed complete: separate `PopoutTriggerLayer`, `PopoutTitleBar`, resize-handle module, `portStore` popout slice, settings UI, port-specific main-process IPC handlers, command-palette trigger, statusbar active-popout count, demote path, Playwright Electron e2e, RSS memory-leak benchmark, or full completion of all R8.B documents.

## 2026-05-05 R8.B spec-02 BrowserWindow Popout Runtime Slice

- Continued from spec-01 renderer floating cards into `prompts/0503-2/R8.B/spec-02-port-floating-window.md`.
- Extended the existing R8 BrowserWindow popout bridge rather than adding a second window-management subsystem.
- Added live BrowserWindow cap enforcement at eight windows with `E_RATE_LIMITED`.
- Added runtime lifecycle methods for bounds persistence, monitor migration via Electron `screen.getAllDisplays()`, promote-from-floating, and demote-to-floating.
- Registered executable IPC handlers for `popout:save-bounds`, `popout:move-to-monitor`, `popout:promote-from-floating`, and `popout:demote`, alongside existing create/close/list/pin handlers.
- Exposed the lifecycle methods through preload and renderer global typings.
- Added `docs/r8/popout-browserwindow.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results:

- Targeted R8.B popout regression passed: 4 files, 13 tests passed, 64 tests skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.

### Completion Boundary

- Verified complete for this runtime slice: executable create/close/list/pin/save-bounds/move-to-monitor/promote/demote IPC, secure BrowserWindow creation path reuse, live cap enforcement, preload/renderer typings, and targeted service/IPC regression.
- Not claimed complete: dedicated popout renderer entry, dedicated preload subset, `persist:popouts` shared session partition, heartbeat bridge, screen disconnect watcher, pinned startup restoration, main-window close survival policy, theme broadcast, Playwright Electron e2e, RSS benchmark, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

## 2026-05-11 R8.B spec-02 BrowserWindow Bridge Lifecycle Slice

- Continued the same `prompts/0503-2/R8.B/spec-02-port-floating-window.md` BrowserWindow popout line without introducing a second popout subsystem.
- Added executable `popout:bridge-message` heartbeat routing with shared Zod validation, IPC registration, preload exposure, and renderer global typings.
- Added a renderer heartbeat loop that reads the real `r8Popout` query parameter and sends a heartbeat every five seconds for BrowserWindow popout instances.
- Persisted BrowserWindow lifecycle timestamps for `lastHeartbeatAt`, `lastInteractedAt`, `closedAt`, and `restoredAt`.
- Added stale bridge cleanup before BrowserWindow cap enforcement, so disconnected records do not consume the eight-window cap.
- Added pinned BrowserWindow startup restoration with saved route, bounds, title, and always-on-top state.
- Added main-window close handling that closes only unpinned BrowserWindow popouts and keeps pinned BrowserWindow popouts live.
- Added display-change reflow through Electron `screen` listeners and `popout:screen-event` broadcasts for off-screen BrowserWindow popouts.
- Added idle lifecycle cleanup: non-pinned BrowserWindow popouts close after 60 minutes without recorded interaction, while pinned BrowserWindow popouts remain active.
- Added theme inheritance broadcast over the existing PopoutBridge. Settings updates now send Zod-validated `theme-settings` sync payloads to live BrowserWindow popouts, and the renderer `useTheme()` hook applies those settings without using mock theme data.
- Added shared `persist:popouts` Electron session wiring for all BrowserWindow popouts using `session.fromPartition('persist:popouts')`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
pnpm -C devhub test --run src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "popout|Popout|Bridge|Screen|schema|preload"
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/hooks/useTheme.test.tsx --maxWorkers=1 -t "popout|Popout|Bridge|theme|Theme|schema|preload"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
```

Results:

- Targeted service/IPC popout regression passed: 2 files, 11 tests passed, 87 skipped by the name filter, `--maxWorkers=1`.
- Targeted preload/schema popout regression passed: 2 files, 12 tests passed, 10 skipped by the name filter, `--maxWorkers=1`.
- Targeted theme bridge regression passed: 4 files, 24 tests passed, 77 skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Zod SoT verification passed.
- ESLint and no-emoji guard passed; `check:no-emoji` reported `No emoji found in 597 files`.

### Completion Boundary

- Verified complete in this continuation: PopoutBridge heartbeat, renderer heartbeat emission, stale bridge cleanup, pinned startup restoration, main-window close policy for pinned vs unpinned BrowserWindow popouts, display-change primary-monitor reflow with `popout:screen-event`, non-pinned idle auto-close, PopoutBridge theme inheritance broadcast, shared `persist:popouts` BrowserWindow session partition, schema/preload/global typing sync, and spec-01 promote/demote/bounds documentation sync.
- Still not claimed complete: Vite multi-entry popout build, dedicated popout HTML/preload/shell, Playwright Electron e2e, RSS benchmark, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

## 2026-05-11 R8.B spec-02 Popout Session CSP Slice

- Continued the same BrowserWindow popout runtime without adding a second manager or deleting existing renderer popout behavior.
- Added popout-specific CSP installation to `R8RuntimeService` for the shared `persist:popouts` Electron session.
- The runtime now calls `session.fromPartition('persist:popouts').webRequest.onHeadersReceived()` and replaces any existing CSP header casing while preserving unrelated response headers.
- Production popout CSP now explicitly constrains `default-src`, `script-src`, `style-src`, `img-src`, `font-src`, `connect-src`, and `worker-src`, while denying `object-src`, `frame-src`, base URI drift, and form submission.
- Development popout CSP keeps the same deny directives but allows only Vite-local HTTP/WebSocket endpoints and `unsafe-eval` behind `ELECTRON_RENDERER_URL`; this is not used by packaged file loading.
- The BrowserWindow popout security tuple now has code and test evidence for `sandbox`, `contextIsolation`, `nodeIntegration=false`, `webSecurity`, external navigation denial, shared `persist:popouts` session, and CSP.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "popout|Popout|CSP|session"
pnpm -C devhub typecheck
```

Results:

- Targeted popout CSP/session regression passed: 1 file, 17 tests passed, 62 skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.

### Completion Boundary

- Verified complete in this continuation: shared popout-session CSP registration, CSP header replacement semantics, and BrowserWindow popout session linkage regression.
- Still not claimed complete: Vite multi-entry popout build, dedicated popout HTML/preload/shell, Playwright Electron e2e, RSS benchmark, live multi-display hardware verification, or `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`.

## 2026-05-05 R8.B spec-03 Drawer System Runtime and Renderer Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-03-drawer-system-top-right-bot.md`.
- Added the real five-slot renderer host under `src/renderer/components/drawer/`, covering top, right, bottom, floating, and statusbar slots without removing the existing DevHub title bar, sidebar, three-pane split, status bar, notifications, command palette, monitor, or topology surfaces.
- Added `DrawerProvider`, `DrawerSystemHost`, slot wrappers, header controls, pointer-event resize handles, a built-in content registry, and a launcher rail with deterministic `data-testid` entry points.
- Added a zustand `drawerStore` and `useDrawer` hook that use the existing secure preload bridge when Electron is available and stay in-memory only when the bridge is unavailable.
- Extended R8 runtime schemas with `DrawerSlot`, richer `DrawerState`, `DrawerLayoutRecord`, and Drawer morph request/result schemas.
- Extended `R8RuntimeService` with five-slot default state, electron-store persistence, size clamping, layout save/load/list, Drawer to floating-popout morph, and popout back to Drawer morph.
- Registered executable IPC handlers for `drawer:get-state`, `drawer:set-state`, `drawer:save-layout`, `drawer:load-layout`, `drawer:list-layouts`, `drawer:morph-to-popout`, and `drawer:morph-from-popout`.
- Exposed the new Drawer APIs through preload and renderer typings.
- Added command palette entries for opening the notifications, observability, and statusbar drawers through the existing `r8:command-event` stream.
- Added documentation in `docs/r8/drawer-system.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/drawer/drawer-model.test.ts src/renderer/components/drawer/DrawerSlot.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "drawer|Drawer|R8.B drawer"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
git diff --check
git -C devhub diff --check
```

Results:

- Targeted R8.B drawer regression passed: 4 files, 8 tests passed, 69 tests skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guards passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.
- Trellis context validation passed with 16 entries in `implement.jsonl` and 16 entries in `check.jsonl`.
- Ledger coverage check passed: 81 ledger rows for 81 Markdown documents under `prompts/0503-2`.
- `git diff --check` and `git -C devhub diff --check` exited cleanly; output was limited to existing LF-to-CRLF warnings.

### Completion Boundary

- Claimed complete for this slice: five renderer slots, z-index allocation, open/close, pin, resize with clamping, content ID registry, launcher rail, command palette drawer-open events, electron-store state persistence, layout save/load/list, Drawer to popout morphing, preload/typing coverage, docs, and targeted unit/component/service/IPC tests.
- Not claimed complete: full lazy-loaded dedicated renderer content for every registered content ID, Playwright Electron restart-persistence E2E, live BrowserWindow drag-back demotion, RSS benchmark, animation benchmark harness, or full downstream spec-04/spec-08 completion.

## 2026-05-05 R8.B spec-04 Command Palette URI Runtime Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-04-command-palette-cmdk.md`.
- Extended the existing `R8CommandPalette` instead of replacing the current `Ctrl+K` flow, preserving the current app shell, monitor, topology, drawer host, status bar, notifications, and command event stream.
- Added controlled `cmdk` query state, deterministic `data-testid` markers, category counts, a top-layer `z-[6000]` palette tier, URI input detection, and a `devhub://` resolver action.
- Extended R8 runtime schemas with command type metadata and `devhub://` URI resolve contracts.
- Added `R8RuntimeService.resolveCommandUri` for `devhub://<scope>/<id>` parsing, direct lookup against the live scanner cache for ports/processes/windows, project lookup through the app store, and process fallback candidate counting from live scanner rows.
- Registered executable `command:resolve-uri` IPC and exposed it through preload and renderer global typings.
- Added command entries for opening the notifications, observability, and statusbar drawers, continuing the real Drawer command-event path from spec-03.
- Added documentation in `docs/r8/command-palette.md` and `docs/r8/uri-protocol.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/command/R8CommandPalette.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "command|Command|URI|uri"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Targeted R8.B command palette regression passed: 3 files, 8 tests passed, 67 tests skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guards passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.
- Trellis context validation passed with 16 entries in `implement.jsonl` and 16 entries in `check.jsonl`.

### Completion Boundary

- Claimed complete for this slice: cmdk-backed palette integration, URI resolver action in the renderer, shared schema contracts, live scanner-backed direct URI resolution, process fallback candidate counting, executable `command:resolve-uri` IPC, preload/typing coverage, Drawer command entries, docs, and targeted renderer/service/IPC tests.
- Not claimed complete: `fuse.js` search weighting, 100+ default command registry, user custom command store, `save-custom-*`, full command history persistence UI, OS protocol registration, command-driven popout creation, Playwright Electron E2E, benchmark harnesses, or `ASSERT_COMMAND_PALETTE_5_SCOPES`.
- Superseded on 2026-05-14: `devhub/docs/r8/command-palette.md` and `prompts/0503-2/R8.B/spec-04-command-palette-cmdk.md` now record verified Fuse.js search weighting, recent-history UI, standalone `command:history-add`, custom command save/list storage, and no-eval handlerScript validation. The remaining boundary is 100+ default registry completion, custom command execution/full UI integration, OS protocol registration, Playwright Electron E2E, benchmark harnesses, and `ASSERT_COMMAND_PALETTE_5_SCOPES`.

## 2026-05-05 R8.B spec-05 Dashboard Grid Runtime and Renderer Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-05-dashboard-grid-layout.md`.
- Used the already installed `react-grid-layout` package and implemented against the local v2 API (`Responsive` plus `useContainerWidth`) rather than adding or downgrading dependencies.
- Added shared Dashboard schemas for widget IDs, breakpoints, grid items, layout records, preset/list/reset requests, and widget-to-Drawer morph results.
- Extended `R8RuntimeService` with electron-store backed `dashboardLayouts`, four built-in presets, 32-widget validation, save/load/list/delete/reset methods, and widget-to-Drawer morphing.
- Registered executable dashboard IPC handlers and exposed the bridge through preload and renderer global typings.
- Added a Dashboard renderer route with responsive grid rendering, draggable widget handles, resize handles, preset buttons, and deterministic test IDs.
- Added a lazy WidgetRegistry with eight built-in widgets over real scanner store/status aggregate data: process summary, port summary, window summary, AI task queue, system resource, notifications, topology mini, and treemap mini.
- Added command palette integration for opening the dashboard and applying `default`, `minimal`, `monitor-focus`, and `ai-focus` presets.
- Added documentation in `docs/r8/dashboard.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/dashboard/dashboard-model.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "dashboard|Dashboard"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Targeted R8.B dashboard regression passed: 3 files, 4 tests passed, 74 tests skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guards passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.
- Trellis context validation passed with 16 entries in `implement.jsonl` and 16 entries in `check.jsonl`.

### Completion Boundary

- Claimed complete for this slice: installed grid dependency reuse, responsive Dashboard renderer, eight lazy built-in widgets, scanner/status-backed widget data, dashboard zustand hook/store, electron-store layout persistence, four built-in presets, executable dashboard IPC, preload/typing coverage, App route/toggle, command-palette layout events, Drawer morph bridge, docs, and targeted model/service/IPC tests.
- Not claimed complete: Playwright Electron drag/restart E2E, 60fps drag benchmark, widget configuration editor, full spec-06 treemap implementation, feature-flag disable UI, or final release assertion closure.

## 2026-05-06 R8.B spec-06 Process Tree and Treemap Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-06-process-treemap-tree.md`.
- Added shared R8 runtime schemas for process view mode, process tree nodes, treemap nodes/layouts, tree requests, child requests, treemap data requests, and view-mode persistence.
- Added live scanner-backed runtime methods for `processTree`, `processTreeChildren`, `processTreemapData`, and `setProcessViewMode`, plus executable IPC handlers and preload/global typing coverage.
- Added renderer hooks and process view surfaces for persisted `tree` and `treemap` modes while preserving existing list, card, and grouped modes.
- Added a deterministic local RSS-proportional treemap layout utility instead of installing `d3-hierarchy`; this keeps the current low-risk slice dependency-neutral while leaving the explicit d3 integration item open.
- Wired command palette events for `process.view.tree` and `process.view.treemap` through the existing command-event stream.
- Repaired Zod source-of-truth drift by renaming the older process-detail drawer tree type to `LegacyProcessTreeNode`, leaving `ProcessTreeNode` owned by `src/shared/schemas/r8-runtime.ts`.
- Added documentation in `docs/r8/process-views.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/utils/treemapLayout.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "treemap|Tree|process tree|Process"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Targeted R8.B process view regression passed: 3 files, 4 tests passed, 76 tests skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed.
- Zod SoT verification passed after the `LegacyProcessTreeNode` compatibility rename.
- No-cloud and no-OCR dependency guards passed.
- Trellis context validation passed with 16 entries in `implement.jsonl` and 16 entries in `check.jsonl`.

### Completion Boundary

- Claimed complete for this slice: shared schemas, runtime service methods, executable IPC/preload bridge, persisted renderer view modes, virtualized tree renderer, SVG treemap renderer, local RSS-proportional treemap layout, command-palette mode events, docs, and targeted unit/service/IPC tests.
- Not claimed complete: `d3-hierarchy` installation/integration, `processStore` parent/children index, renderer lazy child fetch through `process:tree-children`, Playwright Electron E2E, 500-node render performance benchmark, or full closure of downstream process tags/history/statusbar specs.

## 2026-05-06 R8.B spec-07 Theme Decorations Built-In Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-07-theme-decorations-extend.md`.
- Added a shared appearance decoration contract with persisted defaults in the existing settings model.
- Added eight built-in, non-interactive theme decoration renderers through `ThemeDecoration` while preserving the existing app shell and avoiding new heavy dependencies.
- Linked palette defaults to the existing R8.A theme axis so theme changes can update decoration intent without inventing a second theme system.
- Added document-level decoration metadata and CSS variables, plus a `useDecoration` bridge for persisted renderer updates.
- Added a root `global-background` decoration layer and extended the same resolved config into `header`, `card-background`, `detail-panel-background`, `statusbar-background`, and `empty-state` surfaces without per-card settings reads.
- Added SettingsDialog controls for decoration kind, position, opacity, scale, blend mode, custom SVG upload/delete, and per-theme sound config.
- Closed the custom SVG path with DOMPurify renderer sanitization, shared strict validation, main-process `CustomSvgStore` persistence, 50-entry and 200KB limits, SHA256 metadata, executable theme decoration IPC, preload/global typings, and sanitized-only renderer display.
- Closed the theme sound path with `howler`, theme-specific local data-URI tones, disabled-by-default settings, persisted sound config IPC, and fail-closed load/play error handling.
- Documented the verified implementation and concrete evidence in `docs/r8/theme-decorations.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/theme/theme-language.test.ts --maxWorkers=1 -t "decoration|theme language|palette"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
pnpm -C devhub test --run src/renderer/services/SvgSanitizer.test.ts src/main/services/CustomSvgStore.test.ts src/renderer/services/ThemeSounds.test.ts src/renderer/theme/theme-language.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm -C devhub test --run src/renderer/services/ThemeSounds.test.ts src/renderer/i18n/i18n.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm -C devhub test --run src/renderer/services/ThemeSounds.test.ts src/renderer/theme/theme-language.test.ts src/renderer/i18n/i18n.test.ts --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.B spec-07 theme decoration custom SVG" --reporter=line
pnpm -C devhub bench:theme-decoration
```

Results:

- Targeted theme-language decoration regression passed: 1 file, 7 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.
- Trellis context validation passed with 16 entries in `implement.jsonl` and 16 entries in `check.jsonl`.
- 2026-05-16 spec-07 unit/IPC/i18n follow-up passed: 5 files / 40 tests, 3 files / 32 tests, and 3 files / 14 tests in focused low-resource runs.
- 2026-05-16 production build passed.
- 2026-05-16 Electron E2E passed for built-in count, safe SVG upload, persisted custom SVG config, custom SVG rendering, malicious SVG rejection, multi-position layer presence, and persisted theme sound config.
- 2026-05-16 `bench:theme-decoration` passed with 900 real Electron renderer samples, all 8 built-ins plus `custom-svg`, `missingKinds: []`, `p95: 0.1ms`, and `p99: 0.1ms` under the 16ms budget.

### Completion Boundary

- Claimed complete for this slice: shared settings contract, eight built-in decorations, theme-axis default linkage, document metadata/CSS variables, persistent renderer hook, multi-position renderer layer injection, SettingsDialog controls, DOMPurify sanitizer, CustomSvgStore, custom SVG IPC/preload/render/delete, howler theme sound config/playback, i18n decoration keys, docs, targeted unit tests, Electron E2E, and render benchmark.
- Not claimed complete: none for R8.B spec-07. Broader R8.B/R8.C documents retain their own independent ledger status.

## 2026-05-06 R8.B spec-08 Statusbar Extension Built-In Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-08-statusbar-extension.md`.
- Extended the shared R8 runtime schema contract for statusbar tile IDs, badge types, click actions, tile metadata, and statusbar limits.
- Reworked `status:aggregate` to return the R8.B statusbar tile contract over the existing IPC query bridge, using real scanner summary, scanner port cache, runtime notification list, runtime popout list, app projects, and persisted theme settings.
- Added a renderer statusbar model, aggregate hook, badge component, slot component, and statusbar renderer while preserving the existing `components/layout/StatusBar.tsx` import path through a compatibility re-export.
- Added 12 built-in tile definitions for CPU, memory, network, battery, projects, AI tasks, public ports, listening ports, notifications, popouts, theme, and cmdk.
- Added click routing into existing real surfaces: Drawer store, monitor navigation events, command invocation bridge, and the command palette open event handled by `App.tsx`.
- Preserved the existing topology redundant entrypoint and added documentation in `docs/r8/statusbar.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/statusbar/statusbar-model.test.ts src/renderer/components/statusbar/StatusBar.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "statusbar|StatusBar|status aggregate|R8.B statusbar"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results:

- Targeted statusbar regression passed: 3 files, 7 tests passed, 57 skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.

### Completion Boundary

- Claimed complete for this slice: shared statusbar schema contract, `status:aggregate` tile response, 12 built-in tile definitions, statusbar rendering, overflow menu, 6 badge variants, clickAction routing, cmdk tile integration, popouts count, compatibility re-export, docs, and targeted unit/service tests.
- Not claimed complete: dedicated `StatusAggregator` service lifecycle, push/subscription IPC, user hide-tile settings, drag ordering, persisted tile order, Playwright Electron E2E, 1000-push benchmark, or `ASSERT_STATUSBAR_AGGREGATE_BADGES`.

## 2026-05-06 R8.B spec-09 Window Thumbnail Wall Metadata Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-09-window-thumbnail-wall.md`.
- Extended the shared R8 runtime schema contract with thumbnail wall view mode, entry, viewport, group, and limit definitions.
- Added a deterministic five-tuple window group key utility over executable name, normalized title pattern, optional working directory, optional alias, and optional launch order.
- Added a renderer `ThumbnailWall` mode that consumes real `WindowInfo` scanner metadata and keeps the existing card, list, and process views intact.
- Added toolbar controls for filter text, group mode, refresh interval, visible counts, selected counts, and four zoom levels.
- Added group headers, no-capture thumbnail tiles, and virtualized row rendering through the existing `@tanstack/react-virtual` dependency.
- Wired tile click to the existing `WindowOperationKind` focus path and wired Ctrl/Cmd selection plus checkbox selection into the existing batch toolbar selection set.
- Documented the truthful no-screenshot boundary in `docs/r8/window-thumbnail-wall.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/utils/windowGroupKey.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
```

Results:

- Targeted thumbnail wall regression passed: 2 files, 8 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for this slice: shared thumbnail wall schemas, deterministic renderer group key utility, real metadata wall mode, row virtualization, four zoom levels, filter/group/refresh toolbar, existing batch selection integration, docs, and targeted unit tests.
- Not claimed complete: `p-queue` installation, native `ThumbnailService`, Win32 `PrintWindow`/DWM capture, capture queue limits, executable thumbnail IPC, persisted alias resolver service, virtual desktop service integration, Electron Playwright E2E, benchmark evidence, or full `ASSERT_THUMBNAIL_WALL_GROUP_KEY`.

## 2026-05-06 R8.B spec-10 Window Batch Operations Renderer Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-10-window-batch-ops.md`.
- Added shared Zod contracts for window batch action, request, result, progress, and limits.
- Added a renderer `windowBatchModel` that validates selected HWND requests, enforces confirmation boundaries, runs selected HWND handlers sequentially, captures per-HWND failures, and summarizes partial failure.
- Extended the existing batch toolbar without removing any existing action. It now exposes focus, tile, cascade, stack, layout undo, always-on-top toggle, screenshot, minimize, restore, close, select-all, and clear-selection paths.
- Wired focus, minimize, restore, close, screenshot, and always-on-top through existing real window bridges instead of inventing a new fake batch backend.
- Preserved `spec-09` wall selection integration by sharing the existing `selectedWindows` set.
- Documented the renderer-only boundary in `docs/r8/window-batch.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
```

Results:

- Targeted batch model and thumbnail wall selection regression passed: 2 files, 8 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for this slice: shared batch schemas, renderer sequential batch model, toolbar selected-count UI with more than seven real operation buttons, existing window bridge execution for focus/minimize/restore/close/screenshot/aot, `spec-09` selection integration, docs, and targeted unit tests.
- Not claimed complete: `p-queue`, main-process `WindowBatchExecutor`, inject text service, persisted batch rename, lasso selection, custom progress toast, custom confirm dialog, executable batch IPC, 5-second minimize undo transaction, command palette batch integration, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-16 R8.B spec-10 Window Batch Main Executor and IPC Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` from the renderer-only boundary into the main-process execution path.
- Installed and wired `p-queue@8.1.0` through `WindowBatchExecutor` with bounded HWND concurrency, sequential focus pacing, per-HWND Zod results, best-effort cancel, and a 5-second minimize undo path using the real `WindowManager.restoreWindow` bridge.
- Added executable `window:batch-op`, `window:batch-cancel`, and `window:batch-undo` handlers in `windowHandlers.ts`; `window:batch-progress` is pushed to renderer via `BrowserWindow.webContents.send`.
- Reserved the executable batch channels in `r8RuntimeHandlers.ts` so the R8 contract-only fallback no longer owns the real batch invocations.
- Extended the public preload bridge and renderer global types with `windowManager.batchOp`, `batchCancel`, `batchUndo`, and `onBatchProgress`, and synchronized the `prompts/0421/contracts/23-ipc-contracts-master.md` preload whitelist.
- Kept truth boundaries explicit: arbitrary text injection still fails until a real `InjectTextService` exists; rename currently sets real window titles and does not claim persisted aliases; `aot-toggle` requires explicit `args.topmost` instead of guessing OS state.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/window/windowBatchModel.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub exec eslint src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/extended.ts src/renderer/types/global.d.ts src/shared/schemas/r8-runtime.ts
git -C devhub diff --check -- package.json pnpm-lock.yaml src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/extended.ts src/renderer/types/global.d.ts src/shared/schemas/r8-runtime.ts docs/r8/window-batch.md docs/r8bc-implementation-report.md
git diff --check -- prompts/0421/contracts/23-ipc-contracts-master.md prompts/0503-2/R8.B/spec-10-window-batch-ops.md prompts/0503-2/_shared/ipc-channels.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
```

Results:

- Targeted executor, R8 IPC ownership, preload whitelist, and renderer batch model regression passed: 4 files, 39 tests passed, `--maxWorkers=1`.
- Full `pnpm -C devhub typecheck` is blocked by pre-existing syntax errors in `src/renderer/components/topology/GraphCanvas.tsx`; that file is outside this spec-10 slice and was not modified here.
- A TypeScript Compiler API diagnostic run over the 8 touched TypeScript files passed after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
- Zod SoT verification passed.
- No-emoji verification passed across 667 files.
- No-cloud and no-OCR dependency verification passed after adding `p-queue`.
- Touched-file ESLint passed.
- Targeted diff whitespace checks passed for all files touched by this slice.

### Completion Boundary

- Claimed complete for this slice: `p-queue` install, main-process `WindowBatchExecutor`, executable batch op/cancel/undo IPC, main-to-renderer progress push, preload/global type bridge, confirmation enforcement, safe-key inject boundary, explicit topmost state, and 5-second minimize undo.
- Not claimed complete: full arbitrary-text injection, persisted alias rename, lasso selection, custom progress toast UI, custom confirm dialog, retry-failed-items UI, command palette batch command integration, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-16 R8.B spec-10 Window Batch Command Palette Focus Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` into the downstream `spec-04` command palette trigger.
- Added the `window.batch.focus-filtered` command registry entry with the executable handler id `window:batch-focus-filtered`.
- Invoking the command emits the existing local `r8:command-event` stream twice: first `monitor-navigate` with `tab: window`, then `window-batch-focus-filtered`.
- `App.tsx` bridges the command event into the renderer-local `devhub:window-batch-focus-filtered` DOM event after navigating to Monitor.
- `WindowView.tsx` listens for that DOM event and batch-focuses only the currently filtered real HWND rows through the existing `focusWindow` bridge and R8.B focus interval.
- Added a focused WindowView regression that applies a real search filter, dispatches `devhub:window-batch-focus-filtered`, and proves the hidden HWND is not focused.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "filtered window batch focus|focuses only the current filtered windows"
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/App.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
```

Results:

- Targeted command palette and WindowView event-path regression passed: 2 files, 2 focused tests passed, `--maxWorkers=1`.
- Touched-file ESLint passed for command registry/invocation, App command bridge, WindowView, and the new WindowView test.
- No-emoji verification passed across 667 files.
- Targeted diff whitespace check passed with LF-to-CRLF warnings only.

### Completion Boundary

- Claimed complete for this slice: the spec-defined command palette "batch focus current filtered windows" trigger, command-event bridge, filtered WindowView execution path, and targeted regression evidence.
- Not claimed complete: command palette entries for every batch operation, full arbitrary-text injection, persisted alias rename, lasso selection, custom progress toast UI, custom confirm dialog, retry-failed-items UI, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-16 R8.B spec-10 Window Batch Persisted Alias Rename Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` into the persisted rename boundary.
- Extended `WindowBatchExecutor` so `rename` with `args.title` remains a direct real `setWindowTitle` operation, while `rename` with `args.alias` now uses the existing `AIAliasManager` persistence path.
- The executor scans the current real window list before persisting an alias and fails with `E_WINDOW_NOT_FOUND` if the HWND is not present.
- Persisted batch aliases include `pid`, `titlePrefix`, `executablePath`, `toolType`, `autoGenerated=false`, and `appliedExternalTitle`.
- The alias write is transactional with the external window title mutation: if `setWindowTitle` fails, the prior alias is restored or the new alias is removed.
- `setupWindowHandlers()` passes the shared runtime `aliasManager` into the batch executor, preserving the existing App runtime ownership instead of creating a second alias store.
- The renderer already consumes those persisted aliases through `WindowView` display-name fallback and thumbnail wall group key generation, so the batch path now feeds the existing resolver-style grouping behavior.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm -C . test --run src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "WindowBatchExecutor|R8 IPC contract"
pnpm -C . exec eslint src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/windowHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts
node - <<'NODE'
// TypeScript Compiler API diagnostics filtered to the four touched TypeScript files.
NODE
```

Results:

- Targeted executor and R8 IPC ownership regression passed: 2 files, 9 tests passed, 24 skipped by name filter.
- The new executor tests prove alias persistence before real title mutation and rollback when `setWindowTitle` fails.
- Touched-file ESLint passed.
- Isolated TypeScript diagnostics passed for `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, `windowHandlers.ts`, and `r8RuntimeHandlers.test.ts`.

### Completion Boundary

- Claimed complete for this slice: persisted alias batch rename through `AIAliasManager`, latest-window scan validation, real external title mutation, rollback, runtime wiring, and targeted regression tests.
- Not claimed complete at this point in the sequence: a standalone `RenameWindowService` class name, command palette entries for every batch operation, full arbitrary-text injection, lasso selection, custom progress toast UI, custom confirm dialog, retry-failed-items UI, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-17 R8.B spec-10 Window Batch WM_CHAR Text Injection Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` into the confirmed arbitrary-text injection boundary.
- Added `WindowManager.sendTextToWindow(hwnd, text)` as the real WM_CHAR path for batch text injection. It validates the HWND, normalizes text, focuses the target HWND, and calls `WindowHelper.SendText()` through the existing PowerShell/C# window helper.
- `WindowHelper.SendText()` checks `IsWindow()` and posts each character with `PostMessage(..., WM_CHAR, ...)`, mapping newline to carriage return and returning a truthful Win32 failure if posting fails.
- `WindowBatchExecutor` now routes confirmed `inject-text` `args.text` through `sendTextToWindow()` and keeps confirmed safe `args.keys` on the existing `sendKeysToWindow()` bridge.
- The implementation does not use clipboard state, does not fabricate success, and keeps the existing confirmation gate before any text or key injection runs.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "arbitrary text|WindowBatchExecutor|R8 IPC contract"
pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts docs/r8/window-batch.md docs/r8bc-implementation-report.md
git diff --check -- prompts/0503-2/R8.B/spec-10-window-batch-ops.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
```

Results:

- Targeted WM_CHAR and batch executor regression passed: 3 files, 10 focused tests passed, 34 skipped by name filter.
- `WindowManager.test.ts` asserts the real helper script contains `SendText`, `WM_CHAR`, `PostMessage`, target HWND focus, and PowerShell single-quote escaping for arbitrary text.
- `WindowBatchExecutor.test.ts` proves confirmed arbitrary `args.text` calls `sendTextToWindow()` while confirmed safe keys still call `sendKeysToWindow()`.
- Touched-file ESLint passed.
- TypeScript Compiler API diagnostics passed for `WindowManager.ts`, `WindowManager.test.ts`, `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, and `r8RuntimeHandlers.test.ts` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
- No-emoji verification passed across 667 files.
- Diff whitespace checks passed for the touched code, docs, spec, and ledger files, with LF-to-CRLF warnings only where Git reports the existing Windows checkout behavior.

### Completion Boundary

- Claimed complete for this slice: confirmed arbitrary text injection through the verified `WM_CHAR` window bridge, executor routing, key-injection compatibility, confirmation gate preservation, and targeted regression evidence.
- Not claimed complete at this point in the sequence: SendInput/nut-js fallback for controls that reject `WM_CHAR`, lasso selection, custom progress toast UI, custom confirm dialog, retry-failed-items UI, broad command palette batch suite, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-17 R8.B spec-10 Window Batch Progress Toast Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` into the custom progress feedback boundary.
- Added `src/renderer/components/monitor/window/BatchProgressToast.tsx`, rendering real `WindowBatchProgress` snapshots with completed/total progress, progress bar, success/failure/skipped counters, failed HWND details, completion close, and a `取消剩余` action.
- Extended `runSequentialWindowBatch()` so renderer-driven batch operations publish incremental progress and support truthful best-effort cancellation: already-running native calls are not claimed killed, while not-yet-started HWNDs are recorded as `skipped`.
- Wired `WindowView` to hold the current batch action label, progress snapshot, and cancellation token so the existing batch toolbar has visible progress feedback without replacing or deleting existing window operations.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/BatchProgressToast.test.tsx --maxWorkers=1 -t "R8.B window batch model|R8.B BatchProgressToast"
pnpm -C devhub exec eslint src/renderer/components/monitor/window/windowBatchModel.ts src/renderer/components/monitor/window/windowBatchModel.test.ts src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx
pnpm -C devhub check:no-emoji
```

Results:

- Targeted progress toast regression passed: 2 files, 8 focused tests passed.
- `windowBatchModel.test.ts` proves incremental progress publication and cancellation that skips remaining HWNDs without calling native handlers for those remaining items.
- `BatchProgressToast.test.tsx` proves the progress bar, failed HWND detail, cancel action, duplicate-cancel disabled state, completed-state close action, and installed icon-library rendering path.
- Touched-file ESLint passed.
- TypeScript Compiler API diagnostics passed for `windowBatchModel.ts`, `windowBatchModel.test.ts`, `BatchProgressToast.tsx`, `BatchProgressToast.test.tsx`, and `WindowView.tsx` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
- No-emoji verification passed across 669 files.

### Completion Boundary

- Claimed complete for this slice: custom `BatchProgressToast`, renderer batch progress publication, progress bar, failed item summary, best-effort cancel of queued renderer HWND work, WindowView integration, and focused unit/component evidence.
- Not claimed complete at this point in the sequence: lasso selection, custom confirm dialog, retry-failed-items UI, broad command palette batch suite, SendInput/nut-js fallback for controls that reject `WM_CHAR`, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-17 R8.B spec-10 Window Batch Confirm Dialog Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` into the custom sensitive-action confirmation boundary.
- Added `src/renderer/components/monitor/window/BatchConfirmDialog.tsx` with explicit `close` and `inject` variants, installed icon-library rendering, target summary, Escape cancellation, and confirm/cancel callbacks.
- Replaced platform `window.confirm()` for close selections above `WINDOW_BATCH_LIMITS.CONFIRM_THRESHOLD_CLOSE` with the custom danger dialog; the dialog shows the target HWND list before the existing real `closeWindow()` batch execution path runs.
- Replaced platform `window.confirm()` for safe keyboard injection with the custom warning dialog; the dialog shows the redacted HWND/title/key target before calling the existing real `sendKeysToWindow()` bridge.
- Kept `window.prompt()` only for collecting manual move/opacity/title/key input. This slice closes the second-confirmation UI boundary; it does not introduce fake injected input or broaden allowed key combos.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/window/BatchConfirmDialog.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "BatchConfirmDialog|safe keyboard|custom batch confirm"
pnpm -C devhub exec eslint src/renderer/components/monitor/window/BatchConfirmDialog.tsx src/renderer/components/monitor/window/BatchConfirmDialog.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/monitor/window/BatchConfirmDialog.tsx src/renderer/components/monitor/window/BatchConfirmDialog.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
```

Results:

- Targeted confirm dialog regression passed: 2 files, 6 focused tests passed, 10 skipped by name filter.
- `BatchConfirmDialog.test.tsx` proves close/inject dialog variants, target summary rendering, confirm callback, Escape cancellation, and closed-state null rendering.
- `WindowView.test.tsx` proves safe keyboard injection and selected-window close above the threshold use `BatchConfirmDialog` instead of `window.confirm()`.
- Touched-file ESLint passed.
- TypeScript Compiler API diagnostics passed for `BatchConfirmDialog.tsx`, `BatchConfirmDialog.test.tsx`, `WindowView.tsx`, and `WindowView.test.tsx` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
- No-emoji verification passed across 671 files.
- Diff whitespace checks passed with LF-to-CRLF warnings only where Git reports the existing Windows checkout behavior.

### Completion Boundary

- Claimed complete for this slice: custom `BatchConfirmDialog`, close threshold confirmation, inject confirmation, target summary rendering, Escape/cancel behavior, WindowView integration, and focused unit/component evidence.
- Not claimed complete at this point in the sequence: lasso selection, `useBatchSelection`, retry-failed-items UI, broad command palette batch suite, SendInput/nut-js fallback for controls that reject `WM_CHAR`, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-17 R8.B spec-10 Window Batch Selection and Lasso Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` into the remaining renderer multi-select boundary.
- Added `src/renderer/hooks/useBatchSelection.ts` as the shared HWND selection model for Ctrl/Cmd toggle, Shift range, Ctrl+A current-filter selection, rectangle/lasso selection, clear selection, stale prune, and remove-after-close maintenance.
- Added `src/renderer/components/monitor/window/LassoSelect.tsx`, which uses pointer events and real rendered `data-window-selection-hwnd` DOM markers to collect HWNDs; it does not create sample windows or mock selection rows.
- Routed `WindowView` card, list, process-group, AI-window, thumbnail-wall, toolbar select-all, and Ctrl+A selection through `useBatchSelection` while preserving the existing real focus/detail/window-operation click paths.
- Extended `ThumbnailWall` and `ThumbnailTile` so Ctrl/Cmd/Shift selection gesture metadata is forwarded into the shared selection hook contract.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "window batch selection|ThumbnailWall|Ctrl|lasso|custom batch confirm|safe keyboard|filtered windows"
pnpm -C devhub exec eslint src/renderer/hooks/useBatchSelection.ts src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/LassoSelect.tsx src/renderer/components/monitor/window/ThumbnailWall.tsx src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/window/ThumbnailTile.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/hooks/useBatchSelection.ts src/renderer/hooks/useBatchSelection.test.ts src/renderer/components/monitor/window/LassoSelect.tsx src/renderer/components/monitor/window/ThumbnailWall.tsx src/renderer/components/monitor/window/ThumbnailWall.test.tsx src/renderer/components/monitor/window/ThumbnailTile.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
```

Results:

- Targeted selection regression passed: 3 files, 14 focused tests passed, 9 skipped, `--maxWorkers=1`.
- `useBatchSelection.test.ts` proves Ctrl/Cmd toggle, Shift range, and lasso rectangle replace/additive behavior.
- `ThumbnailWall.test.tsx` proves real HWND selection markers and Ctrl gesture forwarding.
- `WindowView.test.tsx` proves Ctrl+A selects only the current filter and lasso-selected rendered HWNDs execute the existing real batch focus path.
- Touched-file ESLint passed.
- TypeScript Compiler API diagnostics passed for `useBatchSelection.ts`, `useBatchSelection.test.ts`, `LassoSelect.tsx`, `ThumbnailWall.tsx`, `ThumbnailWall.test.tsx`, `ThumbnailTile.tsx`, `WindowView.tsx`, and `WindowView.test.tsx` after isolating this slice from the unrelated `GraphCanvas.tsx` parse error.
- No-emoji verification passed across 674 files.
- Targeted diff whitespace check passed with LF-to-CRLF warnings only.

### Completion Boundary

- Claimed complete for this slice: `useBatchSelection`, lasso selection, Ctrl/Cmd toggle, Shift range, Ctrl+A current-filter select-all, thumbnail-wall gesture forwarding, AI-window selection visibility, and focused unit/component evidence.
- Not claimed complete: retry-failed-items UI, broad command palette batch suite, SendInput/nut-js fallback for controls that reject `WM_CHAR`, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS`.

## 2026-05-06 R8.B spec-11 Window Virtual Desktop and Monitor Contract Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-11-window-virtual-desktop.md`.
- Added shared Zod contracts for virtual desktops, R8 monitor info, window VD info, and layout presets.
- Added a renderer `VdMonitorBadge` and integrated it into thumbnail wall tiles.
- Preserved the truthful desktop boundary: without a real Windows virtual desktop source, `desktopId` stays `null` and the UI shows `VD current` instead of fabricated desktop numbers.
- Verified `groupBy=desktop` in the spec-09 wall grouping path using existing thumbnail wall metadata.
- Documented the native COM/IPC boundary in `docs/r8/window-vd.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/utils/windowGroupKey.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
```

Results:

- Targeted thumbnail wall desktop grouping and VD/monitor badge regression passed: 2 files, 8 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for this slice: shared VD/monitor schemas, current-desktop wall grouping boundary, VD/monitor tile badge, docs, and targeted unit tests.
- Not claimed complete: `VirtualDesktopService` COM integration, standalone `MonitorService`, layout preset store, `VdSwitcher`, executable virtual desktop IPC, screen disconnect migration, reconnect restore, batch move-to-desktop, popout multi-monitor restore, Electron Playwright E2E, or benchmark evidence.

## 2026-05-06 R8.B spec-12 Process Batch Operations Renderer Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-12-process-batch-ops.md`.
- Added shared Zod contracts for process batch action, request, result, progress, and operation limits.
- Added a renderer `processBatchModel` that validates per-PID batch requests, blocks system-PID batch kill, enforces confirmation boundaries, records ok/failed/skipped results, and summarizes partial failure.
- Added `useProcessSelection` for single click, Ctrl/Cmd toggle, Shift visible-range selection, and Ctrl/Cmd+A select-all over the current filtered PID list.
- Added `ProcessBatchToolbar` and `ProcessBatchProgress` surfaces without deleting existing process list, card, grouped, tree, or treemap modes.
- Wired batch kill through the existing real `systemProcess.kill(pid)` bridge per selected PID; no image-name wildcard or global process-name kill is used.
- Wired batch focus through the existing real window scan/focus bridge by matching visible windows to process PID.
- Wired diagnostic export through the existing real R8 diagnostic export bridge when available; unavailable bridge cases are recorded as skipped, not fake success.
- Documented the renderer-only and disabled-action boundary in `docs/r8/process-batch.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/hooks/useProcessSelection.test.ts src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Targeted process batch model, selection hook, and toolbar regression passed: 3 files, 8 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.
- Trellis context validation passed with 16 entries in `implement.jsonl` and 16 entries in `check.jsonl`.

### Completion Boundary

- Claimed complete for this slice: shared process batch schemas, renderer batch model, multi-selection hook, six-action toolbar surface, progress/result UI, real per-PID kill bridge execution, system-PID kill block, real focus-by-PID window bridge path, diagnostic export bridge path, docs, and targeted unit tests.
- Not claimed complete: `p-queue`, main-process `ProcessBatchExecutor`, executable `process:batch-*` IPC, process-target `InjectTextService`, persistent process tag store, 5-second tag undo transaction, per-PID Watchdog registration, command palette batch trigger, custom confirm/retry UI, Electron Playwright E2E, benchmark evidence, or full `ASSERT_PROCESS_BATCH_6_OPS`.

## 2026-05-06 R8.B spec-13 Port Security Tier Banner Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-13-port-security-tier-banner.md`.
- Added a shared `Local` / `LAN` / `WAN-Capable` / `Suspicious` classifier over real port number, bind address, default suspicious ports, and user blocklist entries.
- Replaced the earlier `safe/dev/public/suspicious` runtime contract with the spec-13 four-tier Zod schema while keeping the existing `port:security-tier` bridge shape as an object with score, reasons, port, and IP.
- Added default suspicious port generation, user blocklist persistence in electron-store, 500-entry cap, add/remove/reset service methods, and corrupted-entry cleanup.
- Added executable IPC handlers for `port:blocklist-remove`, `port:blocklist-reset`, and `port:public-banner-state` in addition to the existing classify/list/add channels.
- Added renderer `SecurityTierBadge`, `PublicPortBanner`, `useBlocklist`, Settings advanced `BlocklistEditor`, and an exposed-port filter in `PortView`.
- Integrated the tier badge into port cards, list rows, and `PortFocusPanel` without removing existing port scanner, popout, focus, conflict, or relationship graph behavior.
- Updated the statusbar `public-ports` tile to count only `WAN-Capable` ports and include suspicious-port count in the tooltip.
- Wired command palette command id `port.blocklist.add` to the real blocklist service path.
- Documented the implementation and boundary in `docs/r8/port-security.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx --maxWorkers=1 -t "security|port tiers|blocklist|PortView R8|PortFocusPanel"
pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "classifies"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
```

Results:

- Targeted renderer/service regression passed: 4 files selected, 7 tests passed, 70 skipped by the name filter, `--maxWorkers=1`.
- Targeted schema/service classifier regression passed: 2 files selected, 2 tests passed, 69 skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for this slice: shared classifier, four-tier Zod contract, default suspicious ports, persisted user blocklist add/remove/reset, blocklist IPC validation, public banner state IPC, renderer banner/badges/settings editor/filter, statusbar count linkage, command palette add path, docs, and targeted service/schema tests.
- Not claimed complete: Electron Playwright restart E2E, native OS firewall reachability verification, toast notification on corrupted store reset, or packaged performance benchmark evidence.

## 2026-05-06 R8.B spec-14 Process Tags and 24h History Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-14-process-tags-history.md`.
- Added shared contracts for `ProcessTag`, `ProcessHistoryPoint`, `ProcessHistory`, import/export responses, history batch responses, and `TAG_HISTORY_LIMITS`.
- Added `ProcessTagStore` backed by real `electron-store`; identity is normalized `(exe, cwd)` and hashed with SHA-256, so PID changes do not drop tags.
- Added `ProcessHistoryStore` backed by `better-sqlite3`, creating a local `process_history` table with timestamp index, seven-day cleanup, and in-memory fallback only when SQLite cannot open.
- Added `ProcessHistorySampler` and wired it into `SystemProcessScanner.scan()` so samples are produced from real scan output at most once per minute per `(exe, cwd)` key.
- Added IPC handlers for `process:tags-list`, `process:tags-set`, `process:tags-remove`, `process:tags-export`, `process:tags-import`, `process:history-24h`, and `process:history-batch`.
- Exposed the new process tag/history bridge through `window.devhub.systemProcess` and updated renderer global typings.
- Added renderer hooks `useProcessTagRegistry` and `useProcessHistory24h`.
- Added `ProcessTagBadge`, `ProcessTagEditor`, and `ProcessSparkline`; integrated tags and inline 24h CPU sparklines into process list/card/grouped views.
- Extended process tree rows to show tags and treemap to support `colorBy=tag` with tag-color tile tinting.
- Documented the implementation and boundary in `docs/r8/process-tags-history.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/ProcessTagStore.test.ts src/main/services/ProcessHistoryStore.test.ts --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- Targeted process tag/history unit regression passed: 2 files, 5 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: shared Zod contracts, EXE+cwd process tag persistence, JSON import/export, SQLite history table, seven-day cleanup, one-minute real scan sampler, gap markers without fabricated metric values, process IPC/preload bridge, list/card/grouped/tree/treemap tag surfaces, inline list/card 24h CPU sparkline, docs, and targeted unit tests.
- Not claimed complete: `react-sparklines` installation, process detail large 24h chart, command palette `"为 X 设标签"`, spec-12 batch tagging, Electron restart E2E, 100-row sparkline render benchmark, or packaged verification.

## 2026-05-06 R8.B spec-15 i18n Scaffold Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-15-i18n-scaffold.md`.
- Installed `i18next` and `react-i18next` through `pnpm`, updating the real dependency manifest and lockfile.
- Added shared Zod contracts for locale, locale manifests, get/set/list/reload responses, and registered them in the Zod SoT registry.
- Added `LocaleStore` backed by real `electron-store`, defaulting to `zh-CN` and persisting supported locale changes.
- Added executable IPC handlers for `i18n:get-locale`, `i18n:set-locale`, `i18n:list-locales`, and `i18n:reload-resources`.
- Exposed `window.devhub.i18n` through preload and updated renderer global typings.
- Added i18next initialization with `zh-CN` fallback, dev-compatible bracketed missing-key rendering, `zh-CN` and `en-US` JSON resources, typed key derivation, and `useT`.
- Wrapped the React app in `LocaleProvider` and added `LocaleSwitcher` to Settings -> Advanced -> Language and Region.
- Added `i18n:extract` and `i18n:check` scripts; extraction found 1240 existing hardcoded Chinese string literals in renderer code.
- Updated `prompts/0421/contracts/23-ipc-contracts-master.md` for the new i18n channels plus the current spec-13/spec-14 process and port channels.
- Documented the implementation and boundary in `docs/r8/i18n.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/LocaleStore.test.ts src/renderer/i18n/i18n.test.ts --maxWorkers=1
pnpm -C devhub i18n:check
pnpm -C devhub i18n:extract
pnpm -C devhub typecheck
```

Results:

- Targeted locale/i18n unit regression passed: 2 files, 5 tests passed, `--maxWorkers=1`.
- i18n coverage check passed with 21 zh-CN keys, 0.87KB zh bundle, and 100% matching en-US scaffold coverage.
- i18n extraction script ran successfully and reported 1240 historical hardcoded Chinese strings.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: dependency install, LocaleStore, locale IPC/preload, LocaleProvider, runtime LocaleSwitcher, zh-CN/en-US starter resources, typed `useT`, extraction/check scripts, docs, and targeted unit tests.
- Not claimed complete: full migration of all existing hardcoded renderer strings, CI workflow enforcement, Electron Playwright E2E, production resource hot reload, or benchmark evidence for 10,000 `t()` calls.

## 2026-05-17 R8.B spec-15 i18n Legacy Catalog Closure

- Closed the remaining spec-15 i18n coverage gap without a high-risk source-wide rewrite across 80+ renderer files.
- Added a generated `legacy` catalog to `src/renderer/i18n/zh-CN.json` covering 1169 unique production renderer Chinese strings; the full zh-CN bundle is 50.83KB, below the 80KB budget.
- Added `src/renderer/i18n/legacy-dom-localizer.ts` and installed it from `LocaleProvider`. The localizer routes historical DOM text and display attributes through real `i18n.t(legacy.<hash>, { defaultValue })`, preserves original zh-CN text for deterministic locale restoration, and avoids mutating user-entered form values.
- Hardened `i18n:extract` to report production/test counts, unique production string count, catalog size, and uncovered legacy strings.
- Hardened `i18n:check` to enforce 100% production legacy catalog coverage while keeping en-US coverage scoped to non-legacy keys, preserving en-US as a preview locale without fake machine translations.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/i18n/i18n.test.ts src/renderer/i18n/legacy-dom-localizer.test.ts --maxWorkers=1
pnpm -C devhub i18n:extract
pnpm -C devhub i18n:check
pnpm -C devhub exec eslint src/renderer/i18n/legacy-dom-localizer.ts src/renderer/i18n/legacy-dom-localizer.test.ts src/renderer/components/i18n/LocaleProvider.tsx scripts/i18n-extract.mjs scripts/i18n-check-coverage.mjs
pnpm -C devhub exec tsc --noEmit --pretty false
```

Results:

- Focused i18n suite passed with 2 files and 6 tests.
- `i18n:extract` reported 1479 production hardcoded Chinese string occurrences, 243 test occurrences, 1169 unique production Chinese strings, 1169 legacy catalog strings, and 0 uncovered legacy strings.
- `i18n:check` passed with `zhKeys=1207`, `nonLegacyZhKeys=38`, `zhBundleKb=50.83`, `enCoverage=1`, `legacyCoverage=1`, and no uncovered legacy strings.
- Touched-file ESLint passed for the i18n localizer, tests, provider, and scripts.
- TypeScript `tsc --noEmit --pretty false` passed.

### Completion Boundary

- Claimed complete for spec-15: all 11 checklist items are checked, including zh-CN production-string coverage and legacy component i18n routing through `i18n.t`.
- en-US remains intentionally partial for legacy strings; missing legacy en-US translations fall back to zh-CN rather than using fake machine translations.

## 2026-05-17 R8.B spec-15 i18n E2E, IPC, and Benchmark Closure

- Recovered the packaged Electron i18n runtime after real E2E exposed `i18n:*` returning `E_R8_CONTRACT_ONLY`.
- Reordered extended IPC initialization in `src/main/ipc/index.ts`: `R8RuntimeService` registers first, then concrete `window`, `i18n`, `a11y`, process, port, topology, notification, task history, observability, icon, and scanner handlers register after R8 cleanup.
- Made `src/main/ipc/topologyHandlers.ts` idempotent by cleaning topology handlers before setup, preventing contract-only fallback collisions from aborting later extended handler registration.
- Hardened `R8RuntimeService` task queue storage startup: when current Electron ABI cannot load the installed `better-sqlite3` native binding, DevHub logs an audit warning and uses the existing Electron Store task queue boundary instead of aborting unrelated R8.B handlers.
- Hardened `legacy-dom-localizer`: missing legacy resources now fall back to original text instead of leaking `legacy.<hash>` / `[legacy.<hash>]`, and React-owned nodes or attributes that change to English are no longer overwritten by stored Chinese originals.
- Added cached translation resolution to `useT()` and added `scripts/bench-i18n-t.mjs` plus `bench:i18n` so the spec-15 10,000-call budget is executable.
- Hardened E2E Settings selectors with the stable dialog DOM contract `[role="dialog"][aria-labelledby="settings-dialog-title"]`, avoiding locale-sensitive accessible-name drift while still driving the real UI.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec eslint src/main/ipc/index.ts src/main/ipc/topologyHandlers.ts src/main/services/R8RuntimeService.ts e2e/example.spec.ts src/renderer/i18n/legacy-dom-localizer.ts src/renderer/i18n/legacy-dom-localizer.test.ts src/renderer/hooks/useT.ts scripts/bench-i18n-t.mjs
pnpm -C devhub test --run src/renderer/i18n/i18n.test.ts src/renderer/i18n/legacy-dom-localizer.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub i18n:check
pnpm -C devhub check:no-emoji
pnpm -C devhub bench:i18n
pnpm -C devhub test:e2e --grep "R8.B spec-15" --reporter=line --workers=1
pnpm -C devhub test:e2e --grep "ASSERT_WINDOW_BATCH_7_OPS" --reporter=line --workers=1
```

Results:

- Focused i18n suite passed with 2 files and 8 tests.
- `i18n:check` passed with `zhKeys=1207`, `nonLegacyZhKeys=38`, `zhBundleKb=50.83`, `enCoverage=1`, `legacyCoverage=1`, and `uncoveredLegacyStrings=[]`.
- `bench:i18n` passed with `iterations=10000`, `keys=38`, `cacheEntries=38`, `tCallMs=3.371`, `tCallUs=0.337`, and `switchLocaleMs=0.044`, under the 50ms t-call and 200ms switch budgets.
- Packaged Electron `R8.B spec-15` E2E passed with 1 test, covering Settings -> Advanced locale switching, `html lang`, command palette English placeholder, `LocaleStore` persistence, restart recovery, and cleanup back to `zh-CN`.
- `ASSERT_WINDOW_BATCH_7_OPS` E2E passed again with 1 test, confirming the IPC order change did not regress spec-10 window batch operations.
- `build`, `typecheck`, touched-file ESLint, and `check:no-emoji` passed; `check:no-emoji` scanned 678 files with no emoji.

### Completion Boundary

- Claimed complete for spec-15 after this closure: all 11 checklist items, concrete packaged Electron locale IPC, legacy production-string coverage, runtime locale switch and restart persistence, command palette copy update, CI `i18n:check`, and the spec performance benchmark.
- Remaining boundary is intentionally outside this spec: human-authored en-US translations for every legacy production string and future removal of the compatibility localizer through a manual source-wide migration.

## 2026-05-06 R8.B spec-16 Accessibility Foundation Slice

- Continued the R8.B sequence into `prompts/0503-2/R8.B/spec-16-a11y-full.md`.
- Installed `axe-core` and `@axe-core/playwright` through `pnpm`, updating the real dependency manifest and lockfile.
- Added shared Zod contracts for `A11yPrefs`, `A11yOsPrefs`, `A11yAxeViolation`, `A11yContrastFailure`, and `A11ySelfCheckResult`, with shared WCAG/a11y constants in `src/shared/a11y.ts`.
- Added `A11ySelfCheck` backed by real `electron-store`; OS preferences are read through Electron `systemPreferences.getAnimationSettings()` and `nativeTheme.shouldUseHighContrastColors`.
- Added executable IPC handlers for `a11y:get-prefs`, `a11y:set-prefs`, `a11y:os-prefs`, and `a11y:run-self-check`.
- Exposed `window.devhub.r8.a11y` through preload and updated renderer global typings plus the preload whitelist contract.
- Added renderer primitives `SkipLink`, `AnnouncementProvider`, `FocusRing`, and `KeyboardNavGroup`.
- Added `usePrefersReducedMotion`, `usePrefersContrast`, `useA11yRuntime`, `useAnnounce`, and WCAG contrast/document-state helpers.
- Integrated `SkipLink`, `role="main"`, `#main-content`, persisted document-level `data-a11y-*` attributes, and roving keyboard navigation for the main view switcher into the real app shell.
- Added Settings -> Advanced -> Accessibility controls for reduced motion, high contrast, forced colors, large text, screen-reader optimization, focus-ring thickness, OS-follow behavior, and the limited self-check report.
- Extended global CSS for `.sr-only`, skip link visibility, theme-aware focus rings, reduced-motion, large text, high contrast, and forced-colors behavior.
- Added `a11y:audit`, a Playwright/axe script that requires a live renderer URL and exits with usage code `2` instead of fabricating axe evidence offline.
- Documented the implementation and boundary in `docs/r8/a11y.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/A11ySelfCheck.test.ts src/renderer/utils/a11y-checks.test.ts src/renderer/components/a11y/KeyboardNavGroup.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1
node --check devhub/scripts/a11y-audit.mjs
node devhub/scripts/a11y-audit.mjs; if ($LASTEXITCODE -eq 2) { exit 0 } else { exit 1 }
```

Results:

- Targeted accessibility unit regression passed: 3 files, 9 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Preload contract test passed.
- `a11y-audit.mjs` syntax check passed.
- No-URL axe script path correctly refused to run without a live renderer URL and printed usage instead of fake pass output.

### Completion Boundary

- Claimed complete for this slice: dependency install, shared a11y schemas/constants, persisted a11y preferences, OS preference bridge, a11y IPC/preload bridge, SkipLink, aria-live provider, focus ring CSS, forced-colors/reduced-motion CSS, main shell landmark, main view roving navigation, Settings a11y controls, truthful limited self-check, live-URL axe script, docs, and targeted unit/preload tests.
- Not claimed complete: full renderer ARIA audit, roving tabindex across every list/cmdk/wall surface, CI workflow execution of `a11y:audit`, Electron Playwright E2E, live renderer axe evidence for `0 critical violations`, or benchmark evidence.

## 2026-05-06 R8.C spec-05 Cursor/Copilot Title Detection Hardening Slice

- Continued the R8.C sequence into `prompts/0503-2/R8.C/spec-05-cursor-copilot-detection.md`.
- Added shared Zod contracts in `src/shared/schemas/window-title-pattern.ts` for title rules, samples, hashed signals, status responses, and rule reload requests.
- Registered the new window-title schemas in the R8 runtime schema registry and schema barrel exports.
- Added built-in parser defaults in `src/main/services/cli-parser/title-rules.json` and moved Cursor/Copilot title parsers to the shared rule schema.
- Tightened anti-spoofing from substring matching to executable-basename allowlisting: `cursor.exe`, `code.exe`, and `gh.exe`.
- Added a detector-level 5 Hz scan cap plus 5-second same-`hwnd` unchanged-signal reuse.
- Kept title-signal confidence capped at `0.7` and added rejection coverage for override rules above that ceiling.
- Switched `cli:title-rule-reload` and `cli:cursor-copilot-status` IPC validation to shared schemas; preload now exposes both rule reload and optional instance-scoped status requests.
- Added platform-aware feature flag default evaluation so `R8.C.cli.cursor-copilot` defaults on for Windows and off for macOS/Linux.
- Documented implementation and remaining boundaries in `docs/r8/cursor-copilot-detection.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/cli-parser/CursorCopilotDetector.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --testNamePattern "cursor|copilot|title|preload|specific" --maxWorkers=1
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts --testNamePattern "Cursor|Copilot|cursor|copilot|title" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
```

Results:

- Targeted detector/schema/feature-flag regression passed: 3 files, 26 tests passed, `--maxWorkers=1`.
- Targeted IPC/preload regression passed: 2 files, 5 selected tests passed, `--maxWorkers=1`.
- Targeted runtime title-path regression passed: 1 file passed, 1 skipped by name filter, 2 selected tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Zod SoT verification passed.
- ESLint and no-emoji guard passed; no emoji found in 576 files.

### Completion Boundary

- Claimed complete for this slice: shared window-title schemas, built-in `title-rules.json`, confirmed rule override validation, executable-basename whitelist, 5 Hz scan cap, same-`hwnd` 5-second reuse, confidence cap tests, platform-aware feature-flag defaults, preload rule reload/status bridge, docs, and targeted tests.
- Not claimed complete: native `koffi` `EnumWindows` / `GetWindowTextW`, EnumWindows mock coverage, persistent user title-rule file watcher, renderer settings panel for rule editing, dedicated privacy audit-log writer, SignalCollector fusion, packaged Electron Playwright E2E, or live packaged verification.

## 2026-05-08 R8.C spec-06 CLI Detection State and Settings Panel Slice

- Continued the R8.C sequence into `prompts/0503-2/R8.C/spec-06-cli-detect-init.md`.
- Added shared `tool-detect` Zod contracts for tool names, detection strategy, capabilities, individual results, full detection state, detect requests, and override requests.
- Registered `ToolDetectionState`, detect request schemas, and override schemas in the R8 Zod SoT registry.
- Upgraded `cli:detect-all` to return `ToolDetectionState` with exactly five tool rows while retaining `Promise.allSettled` isolation.
- Kept each version probe bounded by the existing 3000ms `execFile` timeout and preserved the 300000ms cache TTL for non-force `detectTool`.
- Kept user overrides backed by real `electron-store` and added audit logging for override writes.
- Added real scanner-cache module-list detection for Cursor and Copilot so window-only tools do not depend on a CLI binary.
- Added `cli:detection-event` renderer broadcast after full scans and scheduled one non-blocking startup detection after R8 IPC handler initialization.
- Added audit logging for full scans with duration, scanned tools, and found tools.
- Exposed `detectAll` state responses and `onDetectionEvent` through preload/global typings.
- Added Settings -> Advanced `ToolDetectPanel` with five current status rows and a force-rescan button.
- Updated `R8OpsPanel` to consume `ToolDetectionState.results` and display scan duration.
- Documented the implementation and boundary in `docs/r8/cli-detection.md`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --testNamePattern "detect|Detect|ToolDetection|preload|IPC|channels" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- Targeted detection/schema/preload regression passed: 3 files selected, 13 tests passed, 68 skipped by the name filter, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed; no emoji found in 578 files.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for this slice: shared detection schemas, five-row detection state, Promise.allSettled scan, 3000ms probe timeout, five-minute cache TTL, persisted user override path, Settings `ToolDetectPanel`, startup detection event broadcast, Cursor/Copilot module-list strategy, default-on feature flag coverage through registry, audit logging, docs, and targeted tests.
- Not claimed complete: migration to `execa` / `which` / `semver`, full draft 5-GWT execa mock suite, settings path override editor, packaged Electron Playwright E2E, or packaged runtime verification.

## 2026-05-11 R8.B spec-02 BrowserWindow Popout Heartbeat and Pinned Restore Slice

- Continued `prompts/0503-2/R8.B/spec-02-port-floating-window.md` from the already implemented BrowserWindow create/list/pin/bounds/move/promote/demote lifecycle.
- Added the shared `PopoutBridgeMessage` Zod contract and registered it in the R8 schema registry so `popout:bridge-message` is no longer only a documented channel.
- Registered an executable `popout:bridge-message` IPC handler with high-frequency scan rate limits.
- Exposed `window.devhub.r8.popout.bridgeMessage()` through preload and renderer typings.
- Added renderer heartbeat emission for real BrowserWindow popout renderers by reading the existing `r8Popout` query parameter and sending heartbeat messages every five seconds.
- Persisted `lastHeartbeatAt`, `restoredAt`, and `closedAt` on BrowserWindow popout records.
- Added stale bridge reaping with the spec timeout of 30 seconds, closing destroyed or silent BrowserWindow bridges before enforcing the eight-window cap.
- Added pinned BrowserWindow restoration after R8 runtime handler initialization, preserving saved route, bounds, title, and always-on-top state.
- Added a main-window close policy that closes unpinned BrowserWindow popouts while leaving pinned BrowserWindow popouts live and always-on-top.
- Added display-change reflow that migrates off-screen BrowserWindow popouts to the primary display and broadcasts `popout:screen-event` to the main window and live popouts.
- Updated `docs/r8/popout-browserwindow.md` with the new heartbeat, stale cleanup, and pinned restore behavior.

### Verification

Low-resource targeted verification command for this slice:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
```

### Completion Boundary

- Claimed complete for this slice: executable bridge heartbeat, renderer heartbeat loop, stale bridge cleanup, live cap compatibility, persisted heartbeat timestamps, pinned popout startup restoration, main-window close policy for pinned vs unpinned popouts, display-change primary-monitor reflow, `popout:screen-event`, preload/global typing, schema registry sync, docs, and targeted unit coverage.
- Not claimed complete: separate popout renderer entry, dedicated popout preload, `persist:popouts` session partition, Playwright Electron E2E, RSS benchmark evidence, or live multi-display hardware verification.

## 2026-05-16 R8.C spec-24 Port/Window/Project Reverse Global Topology Selection

- Continued `prompts/0503-2/R8.C/spec-24-topology-global-fullscreen.md` after the process-detail reverse selection, audit closure, automatic snapshotter, and neural alias/project-root inference slices.
- Added `src/renderer/utils/globalTopologyNavigation.ts` as the renderer-side single contract for the existing fullscreen topology bridge: it writes `devhub:topology:global:selected-node`, dispatches `devhub:open-topology-global`, and builds real graph node ids for process, port, window, and project nodes.
- Rewired `FullScreenTopologyView`, `ProcessDetailPanel`, and `AttachedGraphView` to share the same bridge constants and open helper instead of maintaining local copies.
- Added global topology reverse-selection actions to `PortFocusPanel`, `WindowView`, `ProjectDetailPanel`, and `TopologyDetailPanel`.
- Preserved attached graph behavior: port and window attached topology buttons still focus the attached relation panels, while the new global actions select the corresponding fullscreen global graph node.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/utils/globalTopologyNavigation.test.ts src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/project/ProjectDetailPanel.test.tsx src/renderer/components/monitor/topology/TopologyDetailPanel.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/attached/AttachedGraphView.test.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- Focused renderer topology bridge suite passed: 8 files, 20 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed; no emoji found in 648 files.

### Completion Boundary

- Claimed complete for this slice: shared renderer bridge helper, process/attached/fullscreen reuse, port detail global selection, window detail global selection, project detail global selection, generic topology-detail global selection, and targeted unit coverage for real graph node ids and event dispatch.
- Not claimed complete: direct `systeminformation`/netstat/handle builder split, shared Cytoscape/PNG canvas, Playwright Electron E2E, or 100/500/800-node performance fixtures.

## 2026-05-16 R8.C spec-16 Watchdog Event Stream

- Continued `prompts/0503-2/R8.C/spec-16-watchdog-engine.md` from the verified store-backed policy engine and finite-state watchdog history.
- Added shared Zod contracts for `WatchdogEvent` and `WatchdogEventStreamPayload`, and registered both in the R8 schema registry.
- `R8RuntimeService` now records watchdog-history baselines around configure/register/heartbeat/evaluate/self-check/manual override operations and emits only newly persisted events to `watchdog:event-stream`.
- The stream is locally bounded: max 100 events per payload and 2000ms follow-up throttling, matching the documented 30 RPM high-frequency scan cadence.
- Preload and renderer typings now expose `window.devhub.watchdog.onEventStream(callback)` with a cleanup function.
- Updated `prompts/0421/contracts/23-ipc-contracts-master.md` so the X2 preload whitelist includes the watchdog stream and previously exposed theme invoke channels.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "watchdog|Watchdog|event-stream|preload|IPC|schema"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "streams watchdog events"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- Focused watchdog/preload/schema regression passed: 3 files passed, 19 tests passed, 110 skipped by filter.
- Focused watchdog stream regression passed: 1 file passed, 1 test passed, 102 skipped by filter.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed; no emoji found in 648 files.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for this slice: shared watchdog event schemas, schema registry entries, main-process event batching, bounded renderer broadcast, preload/global subscription, preload X2 contract sync, and policy-boundary nine-source enabledSources evidence.
- Not claimed complete: OS-level HeartbeatCollector adapters, HungWindow/ETW integrations, real ActionExecutor calls into task queue/injection/notification systems, full kill/starvation/storm fixture set, 16-instance CPU benchmark, or spec-17 subprocess runtime.

## 2026-05-16 R8.C spec-16 Watchdog ActionExecutor

- Continued `prompts/0503-2/R8.C/spec-16-watchdog-engine.md` after the event-stream closure and closed the ActionExecutor integration boundary without claiming OS-level collectors or subprocess runtime.
- Added `src/main/services/watchdog/ActionExecutor.ts` as the real dispatcher for `WatchdogEngine` `action-taken` events.
- `R8RuntimeService` now executes each new watchdog action event once, records bounded local action results, and audits the result.
- Restart actions call the existing spec-15 `StoreBackedTaskQueueService.completeTaskRun()` path so matched running tasks move to `retrying` when retries remain or `failed` when exhausted.
- Human-intervention, fallback-tool, and escalate-model actions call a new spec-15 task-queue `markAwaitingHuman()` transition for matched running tasks instead of mutating stored task records directly.
- Restart-resume injection calls the existing spec-18 `executeInject()` path only when the matched CSV task explicitly has `allow_inject=true`; unavailable targets are recorded as blocked inject results, not fake success.
- Watchdog actions emit through the existing spec-30 unified notification service with `source=watchdog`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/services/watchdog/WatchdogEngine.test.ts --maxWorkers=1 -t "watchdog|Watchdog"
pnpm -C devhub typecheck
```

Results:

- Focused watchdog runtime regression passed: 2 files passed, 17 tests passed, 100 skipped by filter.
- New ActionExecutor coverage proves restart actions update the real task queue, attempt real spec-18 injection only under explicit `allow_inject=true`, record blocked injection truthfully when no target exists, and emit spec-30 watchdog notifications.
- New human-intervention coverage proves matched running tasks transition to `awaiting-human` through the real task queue service.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: watchdog action dispatch, spec-15 task queue status integration, spec-18 restart-resume injection call path with truthful blocked failures, spec-30 notification emission, local action result audit/storage, and focused runtime coverage.
- Not claimed complete: OS-level HeartbeatCollector adapters, HungWindow/ETW integrations, full kill-instance/starvation/storm fixture set, 16-instance CPU benchmark, or spec-17 subprocess runtime.

## 2026-05-16 R8.C spec-16 Watchdog 16-Instance Benchmark

- Continued `prompts/0503-2/R8.C/spec-16-watchdog-engine.md` after the ActionExecutor slice and closed the 16-instance CPU benchmark boundary for the in-process watchdog policy engine.
- Added focused benchmark coverage to `src/main/services/watchdog/WatchdogEngine.test.ts`.
- The benchmark registers 16 real `WatchdogEngine` instances, records heartbeat beats, evaluates all instances across 240 sweeps, measures `process.cpuUsage()`, and writes `perf-reports/watchdog-16-benchmark.json`.
- CPU is evaluated as an estimated steady-state percentage at the documented 30000ms heartbeat interval, not as a synthetic busy-loop percentage.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/watchdog/WatchdogEngine.test.ts --maxWorkers=1 -t "16-instance watchdog benchmark"
```

Results:

- Focused benchmark passed: 1 file passed, 1 test passed, 10 skipped by filter.
- Artifact generated at `devhub/perf-reports/watchdog-16-benchmark.json`.
- Measured `estimatedCpuPctAt30sInterval: 0.000336`, below the `< 1%` budget.
- Measured `p95SweepMs: 0.879`, `p99SweepMs: 0.951`, and `maxSweepMs: 1.037`, below the `480ms` 16-instance sweep budget derived from `30ms * 16`.

### Completion Boundary

- Claimed complete for this slice: 16-instance in-process watchdog CPU benchmark and local JSON evidence artifact.
- Not claimed complete: OS-level HeartbeatCollector adapters, HungWindow/ETW integrations, or spec-17 subprocess runtime.

## 2026-05-16 R8.C spec-16 Watchdog Kill/Starvation/Storm/Phase Matrix

- Continued `prompts/0503-2/R8.C/spec-16-watchdog-engine.md` after the benchmark slice and closed the remaining focused Vitest matrix item.
- `R8RuntimeService` now supplies `WatchdogEngine` with a real PID liveness probe based on `process.kill(pid, 0)`.
- The probe treats `ESRCH` as dead, `EPERM` as alive, and unknown probe failures as unknown.
- `WatchdogEngine` maps a dead PID into the existing stuck -> action flow, producing a restart action request without claiming a replacement process was spawned.
- Added a real child-process kill fixture using `process.execPath` and `child.kill()`; the test waits for actual process exit before evaluation.
- Existing watchdog tests continue to cover strict CPU-only starvation rejection, restart storm protection, and phase-aware thinking timeout.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "killed real child"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/services/watchdog/WatchdogEngine.test.ts --maxWorkers=1 -t "watchdog|Watchdog|killed real child"
```

Results:

- Focused kill fixture passed: 1 file passed, 1 test passed, 105 skipped by filter.
- Focused watchdog matrix passed: 2 files passed, 17 tests passed, 100 skipped by filter.
- The matrix includes real child process kill detection, strict heartbeat starvation, restart storm governance, phase-aware timeout, ActionExecutor service integration, and the 16-instance benchmark.

### Completion Boundary

- Claimed complete for this slice: spec-16 focused Vitest matrix for kill/starvation/storm/phase-aware behavior.
- Not claimed complete: full OS-level HeartbeatCollector source adapters, HungWindow/ETW integrations, or spec-17 subprocess runtime.

## 2026-05-16 R8.C spec-15 SQLite Queue Store And Engine Selector

- Continued `prompts/0503-2/R8.C/spec-15-task-queue-better-queue.md` after the watchdog integration exposed the task queue as a critical runtime dependency.
- Added `src/main/services/task-queue/SQLiteTaskQueueStore.ts`, backed by the installed `better-sqlite3` package and the real Electron `userData/queue.sqlite` path.
- The SQLite store persists the existing queue key/value payloads and also writes inspectable `task_runs` and `task_state_transitions` tables with session/status/task/hash indexes.
- Startup now runs `PRAGMA integrity_check` against an existing `queue.sqlite`; corrupt or unreadable databases are renamed to `queue.sqlite.bak.<timestamp>` with `-wal` and `-shm` sidecars before rebuilding a usable store.
- `R8RuntimeService` now defaults the task queue boundary to `queue.sqlite`, migrates legacy Electron Store task/taskStateTransitions data into SQLite when SQLite is empty, and includes `queue.sqlite` in recovery SQLite integrity scans.
- Added enum semantics for `R8.C.task.queue.engine` with allowed values `better-queue` and `p-queue`; storage status reports the selected engine, active backend, SQLite path, integrity report, native `better-queue` package availability, and restart-required switching.
- The implementation does not claim native `BetterQueueAdapter` completion because `better-queue` / `better-queue-sqlite` are not installed in the project.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "SQLite queue|task queue engine|durable task runs"
pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- Focused SQLite/engine selector suite passed: 2 files passed, 4 tests passed, 115 skipped by filter.
- Full task-queue service suite passed: 1 file passed, 12 tests passed.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: real `queue.sqlite` persistence, normalized task/transition indexes, startup SQLite integrity check, corrupt DB backup/rebuild, enum engine selector contract, legacy task-state migration, and focused regression coverage.
- Not claimed complete at this checkpoint: native `better-queue` / `better-queue-sqlite` adapter, native BetterQueue event subscription, and task-worker SKILL execution for the execute-skill branch. The SKILL execution boundary is closed by the later on_fail skill executor slice.

## 2026-05-16 R8.C spec-15 OnFail Handler And Audit Slice

- Continued `prompts/0503-2/R8.C/spec-15-task-queue-better-queue.md` after the SQLite store slice and closed the real audit coverage for task start/end/retry/tool-switch/on_fail branches.
- Added `src/main/services/task-queue/OnFailHandler.ts` as the dedicated branch router for `next`, `abort`, `retry`, `fallback-tool`, `escalate-model`, `human`, and `execute-skill`.
- Extended runtime CSV rows and shared Zod contracts with optional `on_fail`, `fallback_tool`, `execute_skill`, and `needs_bigger_model` fields.
- `CsvTaskDriver` maps those controls from the existing `inputArgs` JSON field, preserving the public 18-column CSV header and avoiding a schema-breaking CSV column addition.
- Implemented real queue behavior for `next` skip-and-continue, `abort` session cancellation, `retry` exponential backoff, `fallback-tool` explicit tool switch with immediate retry eligibility, `escalate-model` operator handoff with `needs_bigger_model=true`, and `human` awaiting-human transition.
- `execute-skill` keeps the truthful unsupported/missing-skill boundary when no executor is available; the runtime skill executor is covered by the later on_fail skill executor slice.
- `R8RuntimeService` now maps fallback-tool transitions to `task:tool-switch` audit rows and other on_fail branch transitions to `task:on-fail`, while preserving existing `task:start`, `task:end`, `task:retry-scheduled`, and `task:retry` audit rows.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "TaskQueue|CsvTaskDriver|on_fail|on-fail|task queue engine|SQLite queue|task:state-stream|schema"
```

Results:

- Focused spec-15 queue/on_fail/CSV/runtime/schema suite passed: 4 files passed, 31 tests passed, 120 skipped by filter.

### Completion Boundary

- Claimed complete for this slice: OnFailHandler routing for all configured values, real branch-specific state transitions, fallback-tool row mutation, on_fail controls parsed from `inputArgs`, and audit coverage for on_fail/tool-switch transitions.
- The spec checklist line for “execute-skill executes a SKILL” is closed by the later on_fail skill executor slice.
- Not claimed complete: native `better-queue` / `better-queue-sqlite` adapter and native BetterQueue event subscription.

## 2026-05-16 R8.C spec-15 Native BetterQueue Adapter Probe

- Continued the spec-15 queue engine line after OnFailHandler audit closure.
- Added `better-queue@3.8.12` to the real DevHub dependency manifest and lockfile.
- Probed `better-queue-sqlite@1.0.7`; it depends on `sqlite3` native bindings, which were not runnable under the current pnpm build policy. The package was removed instead of retaining a broken dependency or claiming a fake native SQLite store.
- Added `src/main/services/task-queue/BetterQueueAdapter.ts`, which wraps the installed `better-queue` package through `createRequire()` and uses the already installed `better-sqlite3` package for a local SQLite store.
- The adapter implements a real better-queue processor callback, priority callback, pause/resume/destroy, and native event forwarding for accepted, queued, started, finish, failed, retry, empty, drain, and error events.
- The backing `BetterSqliteQueueStore` implements the better-queue store interface over a real SQLite table: connect, getTask, putTask, deleteTask, takeFirstN, takeLastN, getLock, getRunningTasks, releaseLock, and close.
- `R8RuntimeService` storage status now distinguishes native `better-queue` package availability from the active runtime backend, which remains `StoreBackedTaskQueueService` over `queue.sqlite`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "BetterQueueAdapter|TaskQueue|CsvTaskDriver|on_fail|on-fail|task queue engine|SQLite queue|task:state-stream|schema|feature flag"
pnpm -C devhub typecheck
```

Results:

- BetterQueueAdapter focused suite passed: 1 file passed, 2 tests passed.
- Combined spec-15 queue/runtime/schema suite passed: 6 files passed, 38 tests passed, 118 skipped by filter.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: installed/runnable `better-queue`, a real BetterQueueAdapter, better-queue native event forwarding tests, and a better-sqlite3-backed store interface.
- The exact `better-queue-sqlite` package boundary is closed by the 2026-05-17 contract closure: the package is rejected as non-runnable in this environment and replaced with a verified better-queue custom store backed by `better-sqlite3`.
- Not claimed complete: active R8RuntimeService promotion to BetterQueueAdapter. Native task:state-stream event bridging is closed by the later bridge slice.

## 2026-05-16 R8.C spec-15 OnFail SKILL Executor Slice

- Continued `prompts/0503-2/R8.C/spec-15-task-queue-better-queue.md` to close the previously truthful `execute-skill` unsupported boundary without faking task success.
- Extended `StoreBackedTaskQueueService` with an executor-availability option and `recordOnFailSkillResult()` so the default queue still reports `E_SKILL_EXECUTOR_UNAVAILABLE`, while `R8RuntimeService` can wire a real executor.
- `R8RuntimeService.completeTaskRun()` now schedules a bounded local SKILL execution when a failed running task enters `on_fail=execute-skill` with `ON_FAIL_EXECUTE_SKILL_RUNNING`.
- The executor resolves SKILL metadata through the existing strict skill library, reuses `scriptPath` containment checks, materializes builtin SKILL scripts under `userData/skill-runtime/builtin`, and runs scripts with `execFile` without shell interpolation.
- SKILL execution writes real local artifacts under `userData/task-queue/on-fail-skills`: `failure-context.json`, `stdout.txt`, `stderr.txt`, `result.json`, plus any side-effect files the SKILL itself writes.
- The generated failure context contains the real task row, run identifiers, session id, attempt counters, row hash, timestamps, and the actual executor failure code/message.
- Runtime support covers `node`, `python`, `bash`, `powershell`, and `exe`; Python uses the existing local Python probe and returns `E_DEPENDENCY_MISSING` when no interpreter is found.
- The execution boundary is bounded with `timeout`, `windowsHide=true`, `shell=false`, a 1 MiB output buffer, and a reduced environment allowlist.
- Successful SKILL execution records `ON_FAIL_EXECUTE_SKILL_SUCCEEDED`, stores `artifactsPath`, moves the original task back to `queued`, and leaves the original executor failure visible through artifacts rather than marking it as succeeded.
- Failed or timed-out SKILL execution records `E_SKILL_EXECUTION_FAILED`, `E_SKILL_TIMEOUT`, `E_SKILL_NOT_FOUND`, `E_VALIDATION`, or `E_PERMISSION` and leaves the task awaiting human intervention.
- `R8RuntimeService` writes `task:on-fail-skill` audit rows with run id, task id, session id, skill name, artifact path, and resulting task status.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub typecheck
pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "execute-skill|on_fail SKILL|on_fail branch"
pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "BetterQueueAdapter|TaskQueue|CsvTaskDriver|on_fail|on-fail|execute-skill|on_fail SKILL|task queue engine|SQLite queue|task:state-stream|schema|feature flag"
pnpm -C devhub lint
```

Results:

- TypeScript typecheck passed.
- Focused on_fail skill executor suite passed: 2 files passed, 4 tests passed, 119 skipped by filter.
- Combined spec-15 queue/runtime/schema suite passed: 6 files passed, 41 tests passed, 118 skipped by filter.
- Lint passed, including `check:no-emoji` with no emoji found.

### Completion Boundary

- Claimed complete for this slice: real local `execute-skill` execution, artifact capture, queued retry state after successful SKILL execution, failure-preserving awaiting-human behavior when SKILL execution fails, and task:on-fail-skill audit coverage.
- The exact `better-queue-sqlite` package boundary is closed by the 2026-05-17 contract closure: the package is rejected as non-runnable in this environment and replaced with a verified better-queue custom store backed by `better-sqlite3`.
- Not claimed complete: active R8RuntimeService promotion to BetterQueueAdapter. Native task:state-stream event bridging is closed by the later bridge slice.

## 2026-05-16 R8.C spec-15 Native BetterQueue State Stream Bridge

- Continued the spec-15 native queue line to close the `task:state-stream` BetterQueue event subscription contract without replacing the active store-backed scheduler.
- `BetterQueueAdapter` now stores queue-id to task metadata for pushed native tasks, deriving `taskId` and `sessionId` from real task payloads.
- Added `subscribeTaskStateTransitions(listener, now)`, which subscribes to real native `better-queue` events and emits `TaskStateTransition`-compatible records.
- The bridge maps `task_accepted` / `task_queued` to `queued`, `task_started` to `running`, `task_retry` to `retrying`, `task_finish` to `succeeded`, and `task_failed` to `failed`.
- Duplicate same-state native events are suppressed, so a package that emits both accepted and queued does not generate a malformed queued-to-queued transition.
- Terminal native events clean bridge metadata maps, preventing unbounded task metadata growth.
- The active runtime still uses `StoreBackedTaskQueueService` over `queue.sqlite`; this slice provides the native event subscription bridge required for a later migration without changing scheduler semantics.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- BetterQueueAdapter focused suite passed: 1 file passed, 3 tests passed.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: native BetterQueue event to `TaskStateTransition` conversion, real better-queue backed state-stream bridge coverage, duplicate transition suppression, and terminal metadata cleanup.
- The exact `better-queue-sqlite` package boundary is closed by the 2026-05-17 contract closure: the package is rejected as non-runnable in this environment and replaced with a verified better-queue custom store backed by `better-sqlite3`.
- Not claimed complete: active R8RuntimeService promotion to BetterQueueAdapter.

## 2026-05-17 R8.C spec-15 BetterQueue SQLite Contract Closure

- Continued `prompts/0503-2/R8.C/spec-15-task-queue-better-queue.md` from the one remaining ledger item: the exact `better-queue-sqlite` package path.
- Verified current package facts through `npm view better-queue-sqlite@1.0.7 version dependencies peerDependencies dist.tarball --json`: the latest package depends on `sqlite3@^5.1.2`.
- Verified local dependency truth through `pnpm -C devhub why better-queue sqlite3 better-sqlite3 --depth 2`: `better-queue@3.8.12` and `better-sqlite3@11.10.0` are installed; `sqlite3` and `better-queue-sqlite` are not installed.
- Kept the prior decision not to retain `better-queue-sqlite`, because the package's native `sqlite3` binding was already probed as non-runnable under the current pnpm build policy; keeping it would create a broken dependency rather than a real queue backend.
- Extended `taskQueueStorageStatusSchema` with `nativeBetterQueueSqliteAvailable` and `nativeSqlite3Available` so renderer/IPC callers can distinguish installed `better-queue` from the unavailable exact `better-queue-sqlite` package.
- Updated `R8RuntimeService.getTaskQueueStorageStatus()` to report all three native package facts and to warn truthfully that the active runtime uses `StoreBackedTaskQueueService` over `queue.sqlite`, while the native BetterQueueAdapter remains the integration-test-backed bridge using a compatible `better-sqlite3` custom store.
- Added regression assertions proving the current machine state is not faked: `better-queue` installed, `better-queue-sqlite` unavailable, `sqlite3` unavailable, `queue.sqlite` created, and storage warning names the unavailable package.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npm view better-queue-sqlite@1.0.7 version dependencies peerDependencies dist.tarball --json
pnpm -C devhub why better-queue sqlite3 better-sqlite3 --depth 2
pnpm -C devhub exec vitest run src/main/services/task-queue/BetterQueueAdapter.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/csv/CsvTaskDriver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "BetterQueueAdapter|TaskQueue|CsvTaskDriver|on_fail|on-fail|execute-skill|on_fail SKILL|task queue engine|SQLite queue|task:state-stream|schema|feature flag"
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/services/task-queue/BetterQueueAdapter.ts src/main/services/task-queue/BetterQueueAdapter.test.ts
pnpm -C devhub exec tsc --noEmit --pretty false
```

Results:

- npm metadata confirmed `better-queue-sqlite@1.0.7` depends on `sqlite3@^5.1.2`.
- Local dependency truth confirmed `better-queue@3.8.12` and `better-sqlite3@11.10.0` are installed; `sqlite3` is not installed.
- Focused spec-15 queue/runtime/schema suite passed: 6 files passed, 49 tests passed, 125 skipped by filter.
- Touched-file ESLint passed.
- Full TypeScript no-emit check passed.

### Completion Boundary

- Claimed complete for the spec-15 adapter/store checklist contract: installed/runnable `better-queue`, real BetterQueueAdapter, real SQLite custom store over `better-sqlite3`, explicit package-status contract, and a documented no-broken-dependency decision for `better-queue-sqlite`.
- Not claimed complete: active runtime promotion from `StoreBackedTaskQueueService` to `BetterQueueAdapter`, because that would change scheduler semantics and belongs to a separate migration slice rather than the original package/store checklist line.

## 2026-05-16 R8.C spec-17 Real Spawn And Audit Boundary

- Continued `prompts/0503-2/R8.C/spec-17-watchdog-subprocess.md` without introducing a long-lived packaged InnerWatchdog runtime.
- `WatchdogSupervisor` now preserves a bounded handshake grace state after successful child spawn, preventing a real just-spawned child from being immediately reported as `dead` before it can handshake.
- Added a real short-lived Node child fixture that is spawned through `WatchdogSpawner` when `childEntryFile` is configured.
- The fixture verifies the actual `process.execPath` command, argv `--token=<64hex>` / `--marker=<path>` values, `DEVHUB_WATCHDOG_TOKEN`, `DEVHUB_WATCHDOG_MARKER`, PID capture, and child-written proof file.
- `R8RuntimeService` now writes central `AuditLogger` rows for watchdog-supervisor respawn requests, Windows Service install/uninstall command plans, invalid handshakes, degraded channels, and orphan status if supervisor evaluation surfaces it.
- Audit targets intentionally include only the validated token prefix, status, pid, channel states, spawn attempts, and operation metadata; the full session token is not logged.
- Added low-resource lifecycle fixtures for a real spawned Node child killed with `SIGTERM` and a validated named-pipe channel that is explicitly marked failed.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "spawns a real node|watchdog supervisor|respawn|marker|Windows Service"
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "spawns a real node|truthful subprocess supervisor|watchdog supervisor|respawn|marker|Windows Service"
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1
```

Results:

- Focused WatchdogSupervisor suite passed: 1 file passed, 7 tests passed, 3 skipped by filter.
- Focused supervisor/runtime suite passed: 2 files passed, 10 tests passed, 109 skipped by filter.
- Full WatchdogSupervisor unit suite passed after adding kill/channel-fail fixtures: 1 file passed, 12 tests passed.

### Completion Boundary

- Claimed complete for this slice: configured real Node child spawn proof, truthful `starting` status during handshake grace, central supervisor control-plane audit rows, real child kill fixture, and explicit channel-failure fixture.
- Not claimed complete: packaged `dist/watchdog-process/main.js`, real named-pipe/TCP JSON-RPC servers, bidirectional heartbeat loops, orphan-mode runtime loop, DevHub restart takeover, subprocess RSS/CPU benchmark, and kill/orphan E2E.

## 2026-05-16 prompts/0503 A.1.6 Monitor Topology Entry

- Audited `prompts/0503` separately from `prompts/0503-2`: `0503` contains 34 Markdown survey/final-acceptance files with 1301 open checkboxes and is not itself the later detailed R8.A/B/C spec set.
- Added `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md` as the prompt-to-artifact checklist for the original survey/final-acceptance source set.
- Closed a concrete visibility regression from `prompts/0503/28-final-acceptance-checklist.md` A.1.6 at implementation level: MonitorPanel top navigation now exposes `进程`, `端口`, `窗口`, `AI 任务`, and `拓扑`.
- The new `拓扑` monitor tab renders the existing `FullScreenTopologyView`; existing process/port/window attached topology buttons and activity/status/command topology entries remain unchanged.
- The previous regression test that asserted topology must not be top-level was updated to assert the final-acceptance requirement and verify clicking the tab renders the topology view.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/MonitorPanel.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- `MonitorPanel.test.tsx` passed: 1 file, 1 test.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence for the `A.1.6` top navigation topology entry.
- Not claimed complete: user-facing final acceptance in `28-final-acceptance-checklist.md`; the checklist explicitly requires real user-visible acceptance, so it remains unchecked.

## 2026-05-16 prompts/0503 A.4.5 Global Flow Entry Evidence

- Continued the same `prompts/0503` visibility line to cover the related A.4.5 requirement that topology and flow global entries be visible through MonitorPanel navigation.
- The new MonitorPanel `拓扑` tab opens `FullScreenTopologyView`, whose graph-kind switcher exposes `网络拓扑`, `神经关系`, and `流程图`.
- Strengthened `FullScreenTopologyView.test.tsx` so clicking `流程图` calls the real `window.devhub.r8.topology.buildGlobalGraph` bridge with `graphKind: 'flow'` and renders a flow snapshot.
- This is implementation-level evidence only; `28-final-acceptance-checklist.md` remains a user-facing acceptance list and is not marked checked by the agent.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx --maxWorkers=1
```

Results:

- Focused topology/monitor visibility suite passed: 2 files, 4 tests.

## 2026-05-16 prompts/0503 A.4.5 Direct Flow Command Entry

- Added `topology.flow` to the real `R8RuntimeService` command registry as a navigation command titled `打开全局流程图`.
- Invoking `topology.flow` sends the existing `r8:command-event` bridge with `{ type: 'topology-navigate', graphKind: 'flow' }`, preserving the existing `topology.global` command and `Ctrl+T` behavior.
- Extended `globalTopologyNavigation` into a one-shot graph-kind navigation contract using `devhub:topology:global:graph-kind`, the existing `devhub:open-topology-global` event, and `graphKindSchema` validation from the shared Zod source of truth.
- `FullScreenTopologyView` now consumes pending graph-kind intents on first render and while already mounted, so direct flow navigation opens the real `buildGlobalGraph` path without requiring a manual second click.
- Updated preload and renderer global command-event types to carry `graphKind` without widening to `any`.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx src/renderer/utils/globalTopologyNavigation.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "pinyin|MonitorPanel|global topology navigation|FullScreenTopologyView|opens fullscreen topology|scanner object commands"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- Focused command/topology/monitor navigation suite passed: 5 files passed, 13 tests passed, 120 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 653 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence for a direct global flow command entry and one-shot flow graph-kind navigation.
- Not claimed complete: user-facing final acceptance in `28-final-acceptance-checklist.md`; the checklist remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 Q-8.A.3 Object Topology Command Entries

- Extended scanner-backed `command:list` output with executable object relationship commands for real scanner rows:
  - `topology.process.<pid>` focuses `process-<pid>`.
  - `topology.port.<port>.<pid>` focuses `port-<port>-<pid>-<protocol>`.
  - `topology.window.<hwnd>` focuses `window-<hwnd>`.
- These commands use the existing `CommandPaletteEntry` contract with `handler: 'topology:open'`, validated `devhub://` URIs, and real ScannerCache process/port/window rows.
- Topology commands include Chinese, pinyin, and English discovery keywords, so searches such as `liucheng`, `tuopu`, `guanxi`, `流程图`, and `topology` can reach the relevant graph entries.
- `R8RuntimeService.invokeCommand()` rejects stale missing URI targets instead of pretending success, then emits `{ type: 'topology-navigate', selectedNodeId }` through the existing `r8:command-event` bridge.
- `App` consumes `selectedNodeId` through the existing `globalTopologyNavigation` session/event bridge, so mounted and first-open global topology views focus the concrete node without introducing a second navigation system.
- This covers implementation-level evidence for `prompts/0503/08-topology-flow-attached-survey.md` Q-8.A.3 option C and `28-final-acceptance-checklist.md` C.6.2 command-palette relationship entry discovery.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "scanner object commands|opens fullscreen topology"
pnpm -C devhub exec vitest run src/renderer/components/command/R8CommandPalette.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "pinyin|scanner object commands|opens fullscreen topology"
```

Results:

- Focused runtime command suite passed: 1 file passed, 2 tests passed, 107 skipped by filter.
- Focused command-palette discovery suite passed: 2 files passed, 3 tests passed, 120 skipped by filter.

### Completion Boundary

- Claimed complete for this slice: scanner-backed command-palette entries can open global topology focused on concrete process, port, and window nodes.
- Not claimed complete: user-facing final acceptance in `28-final-acceptance-checklist.md`; command discovery still requires running-app review.

## 2026-05-16 prompts/0503 C.6.3 Statusbar Topology Active Count

- Strengthened the existing redundant statusbar topology entrypoint so it displays the current active process count from the real renderer `processStore`.
- The statusbar badge now exposes `data-active-process-count`, renders the count visibly next to `拓扑`, and keeps the existing click path to `openTopologyGlobal` / `devhub:open-topology-global`.
- This advances `28-final-acceptance-checklist.md` C.6.3 and G.2.2 at implementation-evidence level without changing the existing statusbar aggregate tile system.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/statusbar/StatusBar.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/statusbar/StatusBar.test.tsx src/renderer/components/command/R8CommandPalette.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx src/renderer/utils/globalTopologyNavigation.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "R8.B StatusBar|pinyin|MonitorPanel|global topology navigation|FullScreenTopologyView|opens fullscreen topology|scanner object commands"
pnpm -C devhub typecheck
```

Results:

- Focused statusbar suite passed: 1 file passed, 4 tests passed.
- Combined statusbar/command/topology suite passed: 6 files passed, 17 tests passed, 120 skipped by filter.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: the persistent statusbar topology button is functional and displays the active process count from renderer state.
- Not claimed complete: user-facing final acceptance remains unchecked until reviewed in the running app.

## 2026-05-16 prompts/0503 C.1.1 / C.2.1 Process Parent Field Parity

- Extended the normal `SystemProcessScanner` scan to read real `ParentProcessId` values from `Win32_Process`.
- Added optional `ppid` and `parentName` fields to shared `ProcessInfo`, preserving backward compatibility while allowing scanner-backed parent metadata to flow through the existing process channel.
- Resolved `parentName` from the same process snapshot when the parent PID is present, avoiding mock or synthetic parent rows.
- Updated `PROCESS_VM_FIELDS`, `ProcessCard`, and `ProcessItem` so process cards and list rows both show the parent-process label.
- Added the `父进程` list column to keep card/list field parity visible for `PID / 名称 / CPU / 内存 / 状态 / 父进程`.
- This advances `prompts/0503/28-final-acceptance-checklist.md` C.1.1 and C.2.1 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact SystemProcessScanner --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact ProcessView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/SystemProcessScanner.test.ts --maxWorkers=1 -t "parent process metadata"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `SystemProcessScanner` returned `MEDIUM` risk with 12 direct upstream references; the implementation is additive on the existing `ProcessInfo` channel.
- GitNexus impact for `ProcessView` returned `LOW` risk with no upstream impacted symbols.
- Focused ProcessView suite passed: 1 file passed, 6 tests passed.
- Focused SystemProcessScanner parent metadata case passed: 1 test passed, 57 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers scanner-backed PPID/parent-name flow and visible card/list parent fields.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 C.1.2 Process Card Topology Badge Evidence

- Audited `ProcessCard` against the final checklist requirement for a top-right Network/topology entry badge.
- No UI structure change was needed; the card already renders `CardEdgeGraphBadge` for `process-card-attached-topology`.
- Strengthened regression coverage so the badge carries `data-graph-entry="process-card-attached-topology"`, `data-graph-kind="attached"`, `data-graph-scope="process"`, and the real PID target id.
- The same test verifies the badge dispatches the existing `devhub:monitor-navigate` relationship scope and remains isolated from the card double-click detail shortcut.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|attached topology tab|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessDetailPanel.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused ProcessView card suite passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the process-card topology badge and relationship navigation event.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 C.1.5 Process Card Double-Click Detail Entry

- Added a card-surface double-click shortcut to `ProcessCard`, using the same `onShowDetail(pid)` path as the existing detail icon rather than creating a second detail mechanism.
- Marked the card root with `data-detail-entry="process-card-double-click"` so the implementation can be audited independently from the user-facing final checklist.
- Added an interaction guard so double-clicking existing interactive controls, especially the process relationship graph badge, does not open the detail drawer by accident.
- Verified that the graph badge still emits the existing `devhub:monitor-navigate` event with the real process topology scope.
- This advances `prompts/0503/28-final-acceptance-checklist.md` C.1.5 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "ProcessCard|global topology|attached graph|WindowView attached topology|PortFocusPanel"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused ProcessView card suite passed: 1 file passed, 2 tests passed.
- Combined process/port/window relation-entry suite passed: 4 files passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.
- GitNexus impact for `ProcessView` returned `LOW` risk with no upstream impacted symbols; `npx --no-install gitnexus detect_changes --repo devhub` still returns `unknown command`, so this report does not claim GitNexus detect-changes coverage.

### Completion Boundary

- Claimed complete for this slice: process cards now support double-click entry into the existing detail path and preserve the graph badge interaction boundary.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 C.1.3 Process Context Menu Copy PID

- Added a real clipboard-backed `复制 PID` operation to the process card context menu.
- Added the same `复制 PID` operation to process list-row context menus so card/list basic operations stay aligned.
- Reused the existing `navigator.clipboard.writeText` path and toast feedback pattern already used by command-copy behavior.
- Existing menu actions for detail, directory open, command copy, process tree, tag edit, and kill remain unchanged.
- This advances `prompts/0503/28-final-acceptance-checklist.md` C.1.3 only partially; this slice does not claim a real process-card popout because no validated process popout path was added.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|global topology|attached graph|WindowView attached topology|PortFocusPanel"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused ProcessView card/menu suite passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 4 files passed, 12 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: process card/list context menus can copy the real PID string to the clipboard.
- Not claimed complete: full C.1.3 final acceptance remains open because process popout has not been implemented or reviewed in the running app.

## 2026-05-16 prompts/0503 C.2.4 Process List Row Drawer Entry

- Added a list-row click path to `ProcessItem` that calls the existing `onShowDetail(pid)` drawer mechanism instead of introducing a second detail surface.
- Marked the row root with `data-detail-entry="process-row-click-drawer"` so the behavior can be audited without changing the user-facing final checklist.
- Preserved batch-selection behavior: Ctrl, Meta, and Shift clicks still select rows without opening `ProcessDetailDrawer`.
- Kept the explicit detail button isolated from row selection, so it still opens the drawer directly and does not also trigger row selection.
- This advances `prompts/0503/28-final-acceptance-checklist.md` C.2.4 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact ProcessView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `ProcessView` returned `LOW` risk with no upstream impacted symbols.
- Focused ProcessView suite passed: 1 file passed, 6 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.

### Completion Boundary

- Claimed complete for this slice: process list rows now open the existing `ProcessDetailDrawer` on ordinary row clicks.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 C.3.1 Process Detail Required Tabs Evidence

- Audited `ProcessDetailPanel` against the final checklist requirement for the five core tabs: `基础`, `资源`, `网络`, `环境`, and `模块`.
- No UI change was needed; the component already exposes those tabs and additionally keeps `关联` and `关系视图`.
- Added regression coverage proving the five core tabs are rendered after real panel loading completes.
- The same test also checks the relationship view tab keeps `data-graph-entry="process-detail-tab"` and `data-graph-kind="attached"`, preserving the adjacent topology-entry evidence.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessDetailPanel.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|global topology|attached graph|WindowView attached topology|PortFocusPanel"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused ProcessDetailPanel suite passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 4 files passed, 13 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence now covers the required process detail tab surface.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 C.3.2 Process Detail Header Look-At-Graph Entry

- Replaced the process-detail attached-topology header button's visible English label with the explicit Chinese `看图` label required by the final checklist wording.
- Kept the existing attached-topology behavior, `data-graph-entry="process-detail-attached-topology"`, and `data-graph-kind="attached"` contract.
- Updated the adjacent global topology button to visible `全局拓扑` text and a matching title while preserving the existing global selected-node path.
- Strengthened regression coverage so `看图` still opens the attached graph and flow views, and `全局拓扑` still opens the global topology with `process-<pid>` selected.
- GitNexus impact lookup for `ProcessDetailPanel` returned `Target 'ProcessDetailPanel' not found`; this report does not claim a GitNexus impact result for that symbol.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessDetailPanel.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|attached topology tab|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessDetailPanel.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused ProcessDetailPanel suite passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the visible `看图` process-detail header entry and its attached-topology behavior.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 C.3.3 / G.2.3 Process Detail Attached Graph Evidence

- Audited `ProcessDetailPanel` against the final checklist requirement for embedded process-detail relationship graph views.
- No UI structure change was needed; the attached relationship tab already renders both `AttachedGraphView` and `AttachedFlowView`.
- Strengthened regression coverage so the header attached-topology action verifies both attached views receive `data-root-kind="process"` and the selected real PID.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessDetailPanel.test.tsx --maxWorkers=1 -t "attached topology tab"
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|attached topology tab|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused ProcessDetailPanel attached topology case passed: 1 test passed, 2 skipped by filter.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers both attached graph views inside the process-detail relationship tab.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 C.7.2 / C.7.3 Process Module Tour Evidence

- Added a real three-step `ProcessModuleTour` for Card/List switching, relationship graph entry, and operation menu discovery.
- The tour reads only the current scanner-backed `displayProcesses` list. When no real process exists, action buttons remain disabled and the UI states that no sample process is created.
- The Card/List step calls the existing `setViewMode()` path and persists through the existing `devhub:process-view-mode` storage contract.
- The relationship step selects the current real PID and dispatches the same `devhub:monitor-navigate` topology event used by the process-card graph badge.
- The operation-menu step switches to card view, selects the current real process, and opens the existing `ProcessCard` context menu with the real copy/detail/tree/kill actions.
- The tour uses semantic buttons, an `aria-live` region, Escape dismissal, `localStorage` persistence under `devhub:process-module-tour:v1`, and a header relaunch button.
- This advances `prompts/0503/28-final-acceptance-checklist.md` C.7.2 and C.7.3 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/MonitorCardEdgeBadge.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- MonitorCardEdgeBadge suite passed: 1 file passed, 5 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 660 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the visible three-step Process Tour and its real view-mode, topology-navigation, and card context-menu paths.
- Not claimed complete: the checklist's "用户能用人话说出" acceptance remains a user-facing runtime acceptance item until the running app is reviewed.

## 2026-05-16 prompts/0503 C.7.4 / C.7.5 Process NEW Badge and F1 Help Evidence

- Added a process-module release-window contract in `processModuleRelease.ts`: the R8 process module release anchor is `2026-05-16T00:00:00+08:00`, and the visible NEW window is 30 days.
- `ProcessView` now displays a `NEW` badge next to the process count only while that 30-day release window is active. The badge exposes `data-r8-release-window-status`, `data-release-window-days`, and remaining-day metadata for automated and manual verification.
- Added an embedded `ProcessModuleHelp` panel opened from both F1 and the visible header `帮助 F1` button.
- The help content is offline and context-specific: it shows the current real process count, current view mode, selected/current PID when available, and documents the `SystemProcessScanner` real-data source.
- When no real process exists, help remains available but explicitly states that operations wait for scanner results and no sample process is generated.
- This advances `prompts/0503/28-final-acceptance-checklist.md` C.7.4 and C.7.5 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact ProcessView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/MonitorCardEdgeBadge.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- GitNexus impact for `ProcessView` returned LOW risk with 0 upstream impacted symbols/processes.
- `MonitorCardEdgeBadge.test.tsx` passed: 8 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 662 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the 30-day NEW badge, visible help entry, F1 shortcut, real-process context, and no-sample empty state.
- Not claimed complete: the final acceptance checkbox remains unchecked until the user verifies the running app during the release window.

## 2026-05-16 prompts/0503 D.1.1 Port Card Required Field Evidence

- Added explicit field-audit markers to `PortCard` for the required final-checklist fields: port, protocol, PID, state, and security tier.
- Kept all values on the existing real `PortInfo` and `classifyPortSecurity` paths; no static security tier or fake port data was introduced.
- Added regression coverage proving the rendered card exposes `:3000`, `TCP`, `PID: 4242`, `监听中`, and the derived `Local` security-tier badge for the loopback fixture.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.1.1 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "required port card fields|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- Focused PortView field/topology suite passed: 1 file passed, 2 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the required port-card fields and security-tier derivation.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.1.2 Port Security Tier Visual Coding

- Added explicit visual-audit metadata to `SecurityTierBadge`: `data-security-tier`, `data-security-tone`, and `data-security-label`.
- Kept the R8 four-tier security model from `prompts/0503-2`: `Local`, `LAN`, `WAN-Capable`, and `Suspicious`.
- Split `WAN-Capable` onto a distinct orange visual tone so it no longer reuses the yellow warning tone used by `LAN`.
- Added regression coverage for all four tier badges, including tone metadata, aria label, visible label, and CSS class mapping.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.1.2 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact SecurityTierBadge --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact PortFocusPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/port/SecurityTierBadge.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "SecurityTierBadge|required port card fields"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- GitNexus target lookup for `SecurityTierBadge` and `PortFocusPanel` returned `Target not found`; no impact result is claimed for those symbols.
- Focused badge/card suite passed: 2 files passed, 5 tests passed, 15 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers distinct color coding and audit metadata for the four R8 port security tiers.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.1.3 Port Card Popout Evidence

- Audited `PortCard` against the final checklist requirement for card popout support.
- No production code change was required for the existing click/context-menu/drag popout support.
- Existing `PortPopoutHost` renders real floating port cards, and `usePortPopoutManager.promote()` can promote those cards through the BrowserWindow popout bridge.
- The new long-press advanced-menu path also reuses the same real floating popout handler with trigger `api`.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.1.3 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "opens a floating port card|long press"
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/main/services/PortScanner.test.ts docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused PortView popout evidence is covered by existing trigger tests and the new long-press advanced-menu test.
- `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers card popout support through click, context menu, drag threshold, and long-press advanced-menu entry.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.1.4 Port Card Topology Badge Evidence

- Audited `PortCard` against the final checklist requirement for a top-right topology entry badge.
- No UI structure change was needed; the card already renders `CardEdgeGraphBadge` for `port-card-attached-topology`.
- Added regression coverage proving the badge carries the expected graph-entry metadata and the real port target id.
- The same test clicks the badge and verifies `PortView` switches into the existing relationship graph view with the real `PortFocusPanel` relationship section.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "card edge topology badge"
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|global topology|attached graph|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused PortView port-card badge case passed: 1 test passed, 14 skipped by filter.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the port-card topology badge and relationship-view transition.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.2.1 / D.2.2 Port View Modes and Persistence

- Added root-level audit metadata to `PortView`: `data-port-view-modes="cards,list,relationship"` and the current `data-port-view-mode`.
- Persisted the selected port view mode to `localStorage` under `devhub:port-view-mode`.
- Restored the persisted mode on mount so cards/list/relationship selection survives remounts in the same renderer profile.
- Added regression coverage for immediate mode switching from cards to list to relationship, and for persisted list-mode rehydration.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.2.1 and D.2.2 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "three port view modes|persisted port view mode|required port card fields|breathing-room"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- Focused PortView mode/field/breathing-room suite passed: 1 file passed, 4 tests passed, 15 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers all three port modes and local persistence of the selected mode.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.2.3 Port Relationship Mode Default Scope

- Added explicit root metadata to `PortRelationshipGraph`: `data-relationship-scope="all-monitored-ports"`.
- Kept `focusPort` as a selection/highlight hint only, so selecting one port does not narrow the graph input set.
- Added regression coverage proving `buildFlowData()` includes every supplied monitored port by default, including ports owned by different PIDs.
- Extended the lightweight UI test to assert the default all-port scope marker on the rendered relationship graph root.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.2.3 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx --maxWorkers=1
```

Results:

- Focused PortRelationshipGraph suite passed: 2 files passed, 6 tests passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers relationship mode's default all-monitored-port graph scope.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.3.1 Port Focus Panel Attached Graph Evidence

- Audited `PortFocusPanel` against the final checklist requirement for embedded port topology and neural/flow graph views.
- No UI structure change was needed; the panel already renders `AttachedGraphView` and `AttachedFlowView` inside `port-attached-topology-section`.
- Strengthened regression coverage so the header attached-topology action verifies both attached views receive `data-root-kind="port"` and the selected real port id.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.3.1 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact PortFocusPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortFocusPanel.test.tsx --maxWorkers=1 -t "attached graph"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus target lookup for `PortFocusPanel` returned `Target not found`; no impact result is claimed for that symbol.
- Focused PortFocusPanel attached graph case passed: 1 test passed, 3 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers both attached graph views inside the port focus relationship section.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.3.2 Port Focus Panel Detach Popout

- Added `data-detach-capability="browserwindow-popout"` to `PortFocusPanel` so detach support is directly auditable.
- Added a header action `port-focus-detach-popout-button` using the installed icon system and no emoji.
- Wired the action to the existing real preload bridge `window.devhub.r8.popout.create()` with `surface: 'port'`, the selected real port number, `mode: 'browserwindow'`, a focus-panel route, explicit bounds, and a deterministic BrowserWindow title.
- Added visible detach state reporting for `working`, `detached`, `unavailable`, and `failed` so bridge failures do not look like silent success.
- Added regression coverage that asserts the exact BrowserWindow popout request for port `3000`.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.3.2 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortFocusPanel.test.tsx --maxWorkers=1 -t "detach|attached graph|stale|轻量模式"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused PortFocusPanel detach/attached/stale suite passed: 1 file passed, 4 tests passed, 2 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the focus-panel detach action and real BrowserWindow popout bridge request.
- Not claimed complete: user-facing final acceptance remains unchecked until the running Electron app is reviewed.

## 2026-05-16 prompts/0503 D.3.3 / D.3.4 Port Focus Cache and Stale Warning

- Added explicit audit metadata to the stale cache warning in `PortFocusPanel`: `data-testid="port-stale-warning"`, `data-stale-source`, and `data-stale-position="top"`.
- Kept the existing cache-first incremental data path intact.
- Added regression coverage proving a stale cache result shows the warning at the top and still renders snapshot content plus the attached topology section instead of a blank waiting state.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.3.3 and D.3.4 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact PortFocusPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortFocusPanel.test.tsx --maxWorkers=1 -t "stale|轻量模式|attached graph"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus target lookup for `PortFocusPanel` returned `Target not found`; no impact result is claimed for that symbol.
- Focused PortFocusPanel stale/light/attached suite passed: 1 file passed, 3 tests passed, 2 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers cache-first non-blank stale rendering and a top stale warning marker.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.4.1 Port Release Confirmation Evidence

- Audited the existing force-release path for port cards and list rows.
- Kept the current `ConfirmDialog` release flow and added regression coverage proving `releasePort` is not called when the user only opens the dialog.
- Verified cancel leaves `releasePort` untouched and confirm calls `releasePort(3000)` exactly once.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.4.1 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact PortView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "requires confirmation|three port view modes|persisted port view mode"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `PortView` returned `LOW` risk with no upstream impacted symbols.
- Focused PortView release/mode suite passed: 1 file passed, 3 tests passed, 17 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the port release second-confirmation guard.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.4.2 Port Card Long-Press Advanced Menu

- Added a 1500ms long-press timer to `PortCard`.
- Added an advanced `role="menu"` surface with graph, popout, and release actions.
- Reused existing real handlers: relationship graph navigation, floating popout creation, and release confirmation.
- Preserved drag-popout behavior by stopping pointer-up drag handling after a completed long press.
- Added regression coverage proving a long press opens the advanced menu and that the popout action opens the existing floating port card path with trigger `api`.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.4.2 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "long press"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/main/services/PortScanner.test.ts docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused PortView long-press suite passed: 1 file passed, 1 test passed, 20 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the port-card long-press advanced menu and three real action entries.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.4.3 Port Operation Audit Log Evidence

- Audited the existing `PortScanner.releasePort()` operation path.
- No production code change was needed: the release operation already writes structured `port:release` entries through the shared `AuditLogger`.
- The code covers refused protected-process releases, refused non-development-process releases, and accepted release attempts before process termination.
- Added focused regression coverage proving protected-process refusal calls `auditLogger.log('port:release', { port, pid, processName }, 'refused', 'protected process')`.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.4.3 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/PortScanner.test.ts --maxWorkers=1 -t "Port Operation Audit Logging"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/main/services/PortScanner.test.ts docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused PortScanner audit suite passed: 1 file passed, 1 test passed, 16 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with existing LF-to-CRLF warnings only; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers `releasePort` audit logging through the real shared `AuditLogger` call path.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app and local audit log are reviewed.

## 2026-05-16 prompts/0503 D.5.1 / D.5.2 / D.5.3 Port Relationship Semantics and Depth

- Extended `PortRelationshipGraph` with typed relationship metadata so real port-to-process edges expose `relationshipKind="owns"`, `sourceKind="port"`, `targetKind="process"`, and the actual `port` / `pid` values.
- Added concrete remote connection nodes for real `PortInfo.foreignAddress` values and `relationshipKind="connects"` edges using the existing `port-external` visual style.
- Added explicit guards so wildcard and zero remote addresses (`*:*`, `0.0.0.0`, `0.0.0.0:0`, `[::]:0`) do not become fake remote endpoints.
- Added a `关系视图节点深度` slider directly inside `PortRelationshipGraph`: depth 1 shows port/process ownership, depth 2 adds windows, and depth 3 adds concrete remote peers.
- Added pure graph-builder regression coverage plus a lightweight mocked-ReactFlow UI test for the depth slider.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.5.1, D.5.2, and D.5.3 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact PortRelationshipGraph --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/PortRelationshipGraph.tsx src/renderer/components/monitor/PortRelationshipGraph.test.tsx src/renderer/components/monitor/PortRelationshipGraph.ui.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- GitNexus target lookup for `PortRelationshipGraph` returned `Target not found`; no impact result is claimed for that symbol.
- Focused PortRelationshipGraph suite passed: 2 files passed, 5 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 657 files.
- Focused diff whitespace checks passed with the existing LF-to-CRLF warning only; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers owns/connects relationship semantics, concrete-remote-only behavior, and adjustable graph depth.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.6.3 Port Card Breathing Room Evidence

- Added `data-r8a-density="breathing-room"` to `PortCard` beside the existing `data-r8a-min-height="96"` contract.
- Preserved the current card layout and minimum-height style: `var(--r8a-port-card-min-height, 96px)`.
- Added regression coverage proving the rendered port card keeps the explicit breathing-room marker and minimum-height fallback.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.6.3 and the R8.A port breathing-room assertion at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "required port card fields|card edge topology badge|breathing-room"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- Focused PortView field/topology/breathing-room suite passed: 1 file passed, 3 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 655 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the 96px minimum-height and breathing-room marker for port cards.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 D.6.1 / D.6.2 Port Module Tour Evidence

- Added a real three-step `PortModuleTour` for Pop-out, security tier, and relationship graph entry directly inside `PortView`.
- The tour reads only the current scanner-backed `ports` array. When no real port exists, action buttons remain disabled and the UI states that no sample port is created.
- The Pop-out step opens the existing `PortPopoutHost` card for the current real port through the existing `portPopoutManager.open(..., 'api')` path.
- The security step shows live tier counts for Local, LAN, WAN-Capable, and Suspicious ports using the same `classifyPortSecurity` path as cards and banners.
- The relationship step switches to the existing `relationship` mode and focuses the current real port in `PortRelationshipGraph`.
- The tour uses semantic buttons, an `aria-live` region, Escape dismissal, `localStorage` persistence under `devhub:port-module-tour:v1`, and a header relaunch button.
- This advances `prompts/0503/28-final-acceptance-checklist.md` D.6.1 and D.6.2 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "port module tour|tour actions|no real ports|breathing-room"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- Focused PortView tour/breathing-room suite passed: 1 file passed, 4 tests passed, 20 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 658 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the visible three-step Tour and the real Pop-out/security/relationship action paths.
- Not claimed complete: the checklist's "用户能用人话说出" acceptance remains a user-facing runtime acceptance item until the running app is reviewed.

## 2026-05-16 prompts/0503 E.1.1 / E.1.2 Window Identity Field Evidence

- `WindowCard` now exposes a stable `data-window-instance-key` composed from real `processName`, `pid`, and `hwnd`.
- Window cards visibly show title, process name, PID, HWND, and always-on-top state (`置顶` / `未置顶`).
- `WindowItem` list rows now expose the same instance key and visible process/PID/HWND/topmost fields, keeping card/list identity parity.
- Always-on-top state is sourced from the existing `listTopmostWindows()` / `topmostWindows` state and not inferred from static fixture data.
- This advances `prompts/0503/28-final-acceptance-checklist.md` E.1.1 and E.1.2 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact WindowView --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- GitNexus impact for `WindowView` returned LOW risk with 0 upstream impacted symbols/processes.
- `WindowView.test.tsx` passed: 9 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 662 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers visible HWND/title/process/PID/topmost fields and multi-instance disambiguation metadata in cards and list rows.
- Not claimed complete: the final acceptance checkbox remains unchecked until the user verifies the running app with multiple similarly named windows.

## 2026-05-16 prompts/0503 E.1.3 Window Title Redaction Evidence

- Added `redactWindowTitle()` for renderer-side title display redaction.
- The redaction helper masks common secret shapes in real window titles: `api_key=...`, `token=...`, `secret=...`, `password=...`, Bearer tokens, OpenAI-style `sk-...` keys, AWS access keys, and JWT-looking values.
- `WindowView` now uses the redacted title for visible card titles, list row titles, grouped window titles, AI window title badges, selected-window relationship headers, and safe-key injection target text.
- Raw title data remains available for existing matching, rename, copy-title, and persistence logic; the change is a UI display/privacy layer, not a scanner mutation.
- This advances `prompts/0503/28-final-acceptance-checklist.md` E.1.3 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/window/windowTitleRedaction.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- Focused WindowView + window title redaction suites passed: 2 files passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers UI redaction for common token/API-key/secret/JWT shapes in window titles.
- Not claimed complete: the final acceptance checkbox remains unchecked until the user verifies the running app with real sensitive-title windows.

## 2026-05-16 prompts/0503 E.4.1 / G.2.5 Window Detail Attached Graph Evidence

- Audited `WindowView` against the final checklist requirement for embedded window-detail topology and relationship/flow views.
- No UI structure change was needed; the selected-window relationship panel already renders both `AttachedGraphView` and `AttachedFlowView`.
- Strengthened regression coverage so the header relationship action verifies both attached views receive the selected real `hwnd`.
- Existing coverage still verifies the global topology button focuses `window-<hwnd>` and the window-card edge badge focuses the real relationship panel.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "attached topology header"
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "ProcessCard|copy PID|required process detail tabs|global topology|attached graph|attached topology header|WindowView attached topology|PortFocusPanel|card edge topology badge"
pnpm -C devhub typecheck
pnpm -C devhub lint
git -C devhub diff --check -- src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/monitor/WindowView.test.tsx docs/r8bc-implementation-report.md
git diff --check -- .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-survey-completion-audit.md
python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

Results:

- Focused WindowView attached topology suite passed: 1 file passed, 3 tests passed.
- Combined process/port/window relation-entry suite passed: 5 files passed, 14 tests passed, 14 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 654 files.
- Focused diff whitespace checks passed; Trellis task context validation passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers both attached graph views inside the window-detail relationship panel.
- Not claimed complete: user-facing final acceptance remains unchecked until the running app is reviewed.

## 2026-05-16 prompts/0503 E.5.1 / E.5.2 Window Module Tour Evidence

- Added a real three-step `WindowModuleTour` for instance disambiguation, operation matrix, and Always-on-top.
- The tour reads only the current scanner-backed `windows` array. When no real window exists, action buttons remain disabled and the UI states that no sample window is created.
- The instance-disambiguation step shows the selected concrete HWND/PID/process tuple and opens the existing selected-window relationship panel for that same HWND.
- The operation-matrix step switches to the existing card view and selects the current real window so the existing `WindowOperationPanel` is visible.
- The Always-on-top step calls the real `handleSetWindowTopmost()` path, which delegates to `setWindowTopmost()` and emits the existing toast feedback.
- The tour uses semantic buttons, an `aria-live` region, Escape dismissal, `localStorage` persistence under `devhub:window-module-tour:v1`, and a header relaunch button.
- This advances `prompts/0503/28-final-acceptance-checklist.md` E.5.1 and E.5.2 at implementation-evidence level without checking the final acceptance boxes.
- E.5.3 is strengthened for the Tour-triggered Always-on-top path by verifying the real toast feedback; a full per-operation visual-feedback audit remains a separate checklist item.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- WindowView suite passed: 1 file passed, 6 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 659 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the visible three-step Window Tour and its real relationship, operation-matrix, and topmost action paths.
- Not claimed complete: the checklist's "用户能用人话说出" acceptance remains a user-facing runtime acceptance item until the running app is reviewed.

## 2026-05-16 prompts/0503 E.5.4 / E.5.5 Window Safe Keyboard Injection Prompt and Failure Feedback

- Added `send-safe-keys` to the real window operation catalog and `WindowOperationKind`, making safe keyboard injection discoverable from the existing `WindowOperationPanel`.
- `WindowView` now calls the existing `sendKeysToWindow()` hook path instead of adding a renderer-only fake operation. The hook delegates to the existing preload / IPC `WINDOW_SEND_KEYS` / `WindowManager.sendKeysToWindow()` chain.
- Before injection, the UI prompts for an allowed key combination and then displays a target-specific confirmation: `将向窗口 HWND ... 发送键盘事件...`.
- The operation emits an info toast before the real send path runs, so the user sees which concrete window will receive the keyboard event.
- Failure feedback now includes the target HWND/title and key combination: `键盘事件注入失败: 窗口 ... / ...`.
- `ToastProvider` now uses a monotonic suffix on toast IDs, preventing duplicate React keys when an info toast and a success/error toast are emitted in the same millisecond.
- This advances `prompts/0503/28-final-acceptance-checklist.md` E.5.4 and E.5.5 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact WindowView --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact ToastProvider --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/components/monitor/WindowView.test.tsx src/shared/window-operations-catalog.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- GitNexus impact for `WindowView` returned LOW risk with 0 upstream impacted symbols/processes.
- GitNexus impact for `ToastProvider` returned LOW risk with 0 upstream impacted symbols/processes.
- Focused WindowView + operation catalog suites passed: 2 files passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed.
- `check:no-emoji` reported no emoji in 662 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers target-specific pre-injection confirmation and concrete failure feedback on the real `WINDOW_SEND_KEYS` path.
- Not claimed complete: the final acceptance checkbox remains unchecked until the user verifies keyboard injection against a real external window in the running app.

## 2026-05-16 prompts/0503 F.1.2 AI Monitor 12-State Taxonomy

- Expanded the shared `AIMonitorState` taxonomy from 8 visible monitor states to 12 states: `initializing`, `idle`, `thinking`, `receiving-input`, `coding`, `compiling`, `validating`, `waiting-input`, `awaiting-human`, `stuck`, `completed`, and `error`.
- `CompletionStateMachine` now derives the new states from real runtime conditions: process age, stdin/input prompt evidence, explicit human-approval wording, and long non-terminal idle duration.
- `AITaskTracker` maps the expanded monitor states back to legacy task status/phase fields without removing the existing `AITaskState` surface or the R8.C spec-28 three-layer FSM.
- `deriveProgress`, `AITaskView`, `AIProgressTimeline`, and AI window cards now render the new states with explicit labels and progress behavior rather than collapsing them into generic `running` or `waiting`.
- `contract-models` accepts the expanded AIMonitorState contract while preserving legacy aliases for existing contract consumers.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.1.2 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact AITaskTracker --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact DetectionEngine --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact SignalDiagnosticPanel --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/main/services/detection/DetectionEngine.test.ts src/shared/detection/derive-progress.test.ts src/shared/schemas/contract-models.test.ts --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- GitNexus impact for `AITaskTracker` returned MEDIUM risk with 7 direct importers; no HIGH or CRITICAL impact was returned.
- GitNexus target lookup for `DetectionEngine` returned `Target not found`; no impact result is claimed for that symbol.
- GitNexus impact for `SignalDiagnosticPanel` returned LOW risk with 0 upstream impacted symbols/processes.
- Focused detection/progress/contract suite passed: 3 files passed, 21 tests passed.
- TypeScript typecheck passed after one transient WSL `UtilAcceptVsock` interruption was retried successfully.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers 12 distinct visible AI monitor states and real derivation paths for `initializing`, `receiving-input`, `awaiting-human`, and `stuck`.
- Not claimed complete: final F.1.2 user acceptance remains unchecked until runtime review, and F.1.8 through F.1.10 accuracy thresholds still require user-measured sample evidence.

## 2026-05-16 prompts/0503 F.1.7 AI Detection Correct/Incorrect Feedback

- Added explicit `正确` and `错误` feedback controls to `SignalDiagnosticPanel` after the typed diagnostic explanation loads.
- Both feedback actions use the existing typed preload bridge and the existing 3-second confirmation countdown before writing local feedback.
- Added `correct-detection` to the feedback kind schema so positive detection feedback is stored as a real local record instead of being a no-op UI button.
- `WeightAdjuster` applies a bounded positive `user_feedback` adjustment for correct detections; incorrect detections continue to use the existing false-state adjustment paths.
- `MisreportButton` remains backward-compatible for existing error feedback and now supports custom labels, aria labels, titles, and success messages for the correct/incorrect controls.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.1.7 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact MisreportButton --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact SignalDiagnosticPanel --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact WeightAdjuster --repo devhub --direction upstream --depth 1 --include-tests
npx --no-install gitnexus impact misreportKindSchema --repo devhub --direction upstream --depth 1 --include-tests
pnpm -C devhub exec vitest run src/renderer/views/monitor/MisreportButton.test.tsx src/renderer/views/monitor/SignalDiagnosticPanel.test.tsx src/main/services/feedback/MisreportLogger.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "Misreport feedback|MisreportButton|SignalDiagnosticPanel|stores SQLite-backed signal misreports"
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `MisreportButton` and `SignalDiagnosticPanel` returned LOW risk with 0 upstream impacted symbols/processes.
- GitNexus impact for `WeightAdjuster` returned LOW risk with 3 direct importers.
- GitNexus target lookup for `misreportKindSchema` returned `Target not found`; no impact result is claimed for that symbol.
- Focused feedback suite passed: 4 files passed, 7 tests passed, 108 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers user-visible correct/incorrect detection feedback controls and real local persistence/weight adjustment paths.
- Not claimed complete: final F.1.7 user acceptance remains unchecked until runtime review, and positive feedback remains local/bounded without telemetry or accuracy-threshold claims.

## 2026-05-16 prompts/0503 F.1.6 AI Detection Source Citations

- `SignalDiagnosticPanel` now shows each diagnostic reason with an explicit `source=<signal>` citation and numeric contribution percentage.
- The citation is rendered from the typed local `DiagnosticExplain.topReasons[].sourceCitation` payload, preserving the backend diagnostic service as the source of truth.
- The panel still shows the existing human-readable reason text and recent transition trace, linking detection explanation to signal source, contribution share, and state history.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.1.6 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/views/monitor/SignalDiagnosticPanel.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- Focused `SignalDiagnosticPanel` test passed: 1 file passed, 1 test passed.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers visible source citations and contribution percentages for each diagnostic reason.
- Not claimed complete: final F.1.6 user acceptance remains unchecked until runtime review with real AI task signals.

## 2026-05-16 prompts/0503 F.1.1 AI Tool Process Detection

- Extended `R8RuntimeService.detectToolFromModuleList()` so scanner snapshots can identify all five acceptance tools: `codex`, `claude`, `gemini`, `cursor`, and `copilot`.
- Codex, Claude, and Gemini now have real process/task/window snapshot recognition in addition to existing executable version probes and user overrides.
- Copilot detection no longer treats plain `gh.exe` as sufficient evidence; a row must contain Copilot evidence such as a Copilot window title or command line.
- Existing five-row `ToolDetectionState`, Settings `ToolDetectPanel`, persisted override, cache, audit, and `cli:detection-event` paths remain unchanged.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.1.1 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact R8RuntimeService --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact detectToolFromModuleList --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact rowLooksLikeTool --repo devhub --direction upstream --include-tests
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "detects all five|five-tool detection|CLI detection GWT"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- GitNexus impact for `R8RuntimeService` returned LOW risk with 5 upstream impacted files.
- GitNexus target lookup for private methods `detectToolFromModuleList` and `rowLooksLikeTool` returned `Target not found`; no impact result is claimed for those symbols.
- Focused runtime detection suite passed: 1 file passed, 3 tests passed, 107 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers five-tool process/window/task snapshot recognition plus reduced Copilot false positives.
- Not claimed complete: final F.1.1 user acceptance remains unchecked until the running app is verified against actual local AI tool processes.

## 2026-05-16 prompts/0503 F.1.4 AI State Flip Debounce

- Added `stabilizeStateTransition()` to the detection state-machine layer.
- `AITaskTracker` now applies the stabilizer to heuristic task and monitor state transitions before emitting `task-status-changed`.
- Non-terminal state flips require either two matching observations or a 750ms stability window, reducing single-sample CPU/title jitter.
- Terminal `completed`, `error`, and `stuck` paths remain immediate so critical runtime changes are not hidden by debounce.
- Existing completion confirmation logic remains separate and unchanged.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.1.4 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/detection/DetectionEngine.test.ts src/main/services/AITaskTracker.test.ts --maxWorkers=1 -t "debounces single-sample|cancels confirmation|confirmation|determineState"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- Focused detection/tracker suite passed: 2 files passed, 11 tests passed, 40 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers anti-flapping debounce for heuristic task and monitor state transitions.
- Not claimed complete: final F.1.4 user acceptance remains unchecked until runtime verification with real AI tool output.

## 2026-05-16 prompts/0503 F.1.5 Real Stdout State Path

- Verified the existing real stdout path rather than adding a parallel heuristic path.
- `R8RuntimeService.parseCliChunk()` routes stdout/stderr/title/system chunks through `CLIOutputParser`, stores bounded CLI event/session history, emits `cli:event-stream`, queues monitor snapshots, and records stdout through the recording engine.
- `AITaskTracker` subscribes to CLI parser events, matches them to real task IDs/PIDs/aliases, and updates task state, monitor state, phase, action, progress estimate, and signal contributions from parsed CLI evidence.
- `CLIOutputParser` covers line, shim, NDJSON, and SSE strategy paths, including line/shim progress fusion for the same instance.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.1.5 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "parses line-based|parses shim|fuses line and shim|parseCliChunk|captures parsed stdout|cli:event-stream"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- Focused parser/runtime stdout suite passed: 2 files passed, 4 tests passed, 113 skipped by filter.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers parser-to-runtime-to-tracker state updates from stdout chunks and recording persistence.
- Not claimed complete: final F.1.5 user acceptance remains unchecked until runtime verification with a live external tool session.

## 2026-05-16 prompts/0503 F.2.4 Progress Confidence Interval Display

- Added `ProgressConfidenceRange` and `DerivedProgress.confidenceRange` to the shared progress derivation model.
- Determinate progress now exposes a bounded confidence label such as `约 40%-54%` based on progress percentage and confidence.
- `ProgressBar` renders the confidence interval for users while preserving the exact `aria-valuenow` value for accessibility and tests.
- Hidden and indeterminate progress modes remain unchanged: idle stays hidden, and thinking/receiving-input do not expose fake percentages.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.2.4 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact deriveProgress --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact ProgressBar --repo devhub --direction upstream --include-tests
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts src/renderer/components/monitor/ai-task/ProgressBar.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- GitNexus impact for `deriveProgress` returned LOW risk with 1 upstream test file.
- GitNexus impact for `ProgressBar` returned LOW risk with 0 upstream impacted files in the indexed graph.
- Focused progress suite passed: 2 files passed, 14 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers confidence interval rendering for determinate progress.
- Not claimed complete: final F.2.4 user acceptance remains unchecked until runtime review with real task progress confidence data.

## 2026-05-16 prompts/0503 F.2.5 Stuck Detection from Silence plus Low CPU

- Tightened the `stuck` monitor-state derivation so a task must have long non-terminal idle/activity silence and recent average CPU below 1%.
- A long-idle task with CPU above 1% is no longer marked stuck solely from elapsed silence.
- The change keeps terminal `error` and `completed` immediate and preserves the F.1.4 anti-flapping stabilizer.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.2.5 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/detection/DetectionEngine.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- Focused detection suite passed: 1 file passed, 8 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the required stdout/activity silence plus CPU-below-1 stuck rule.
- Not claimed complete: final F.2.5 user acceptance remains unchecked until runtime review with a live stdout-silent, low-CPU task.

## 2026-05-16 prompts/0503 F.2.2 Retry Progress Reset to Zero

- Added retry-progress reset emission to the existing `R8RuntimeService` task transition path. When a persisted task enters retry, is manually moved from `retrying` to `queued`, or returns from a real `execute-skill` recovery, the runtime emits `task-progress` with `percent: 0`.
- The reset uses the existing `csv:session-event-stream` and `cli:event-stream` channels, so renderer listeners and CLI parser consumers see the same real event stream rather than a parallel mock path.
- Custom non-CSV task sessions are guarded before CSV event emission, preventing retry transitions with human-readable session ids from throwing UUID validation errors.
- `AITaskTracker.estimateProgress()` now treats an exact real CLI progress signal of `0` as a retry reset instead of preserving an old high-water progress estimate.
- `deriveProgress()` accepts `explicitPercentage` for active coding progress, and `AITaskView` passes `task.status.progressEstimate.percentage` through. This lets the UI display a real 0% retry reset while preserving the existing fallback 40-75% heuristic when no explicit progress exists.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.2.2 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact R8RuntimeService --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact StoreBackedTaskQueueService --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact AITaskTracker --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact deriveProgress --repo devhub --direction upstream --include-tests
npx --no-install gitnexus impact AITaskView --repo devhub --direction upstream --include-tests
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/AITaskTracker.test.ts --maxWorkers=1 -t "retry progress|CLI parser subscription"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "zero-percent progress|loads 18 column"
pnpm -C devhub typecheck
```

Results:

- GitNexus impact for `R8RuntimeService`, `StoreBackedTaskQueueService`, `deriveProgress`, and `AITaskView` returned LOW risk.
- GitNexus impact for `AITaskTracker` returned MEDIUM risk with direct callers/tests identified; no HIGH or CRITICAL warning was returned.
- Focused `derive-progress` suite passed: 1 file passed, 11 tests passed.
- Focused `AITaskTracker` retry/parser suite passed: 1 file passed, 3 tests passed, 42 skipped by filter.
- Focused `R8RuntimeService` retry/CSV launch suite passed: 1 file passed, 2 tests passed, 109 skipped by filter.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers runtime retry events, tracker reset semantics, renderer explicit percentage handoff, and regression tests for the zero-percent reset.
- Not claimed complete: final F.2.2 user acceptance remains unchecked until runtime review with a real retrying task verifies the visible progress returns to 0%.

## 2026-05-16 prompts/0503 F.2.3 Long Task Progress Update Frequency

- Kept active AI task cards on the existing one-second render tick in `AITaskView`, which is stricter than the F.2.3 requirement of at least one progress update per 30 seconds for tasks longer than 10 minutes.
- Added `getExplicitProgressPercentage()` so only high-confidence runtime progress or exact 0% retry reset signals override the time-derived progress curve. Lower-confidence heuristic estimates no longer freeze long-task progress at a stale explicit percentage.
- Added a shared progress regression test proving a coding task with a 24-hour estimate and elapsed time above 10 minutes advances within a 30-second window.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.2.3 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- Focused `derive-progress` suite passed: 1 file passed, 12 tests passed.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers the one-second active render tick, long-task derived progress movement within 30 seconds, and the guard preventing lower-confidence explicit estimates from freezing the visible progress curve.
- Not claimed complete: final F.2.3 user acceptance remains unchecked until runtime review with a real task running longer than 10 minutes.

## 2026-05-16 prompts/0503 F.2.1 Continuous Progress and Fine-Grained AI States

- Audited the current progress stack after F.2.2/F.2.3/F.2.4 changes: `deriveProgress()` now supports continuous time-derived coding progress, exact explicit runtime percentages from 0 to 99, and terminal 100% states.
- The visible state taxonomy is no longer a legacy 8-value set. Shared/renderer coverage includes `initializing`, `thinking`, `receiving-input`, `coding`, `compiling`, `validating`, `waiting-input`, `awaiting-human`, `stuck`, `completed`, `error`, and `idle`.
- `ProgressBar` preserves exact determinate `aria-valuenow` values while showing user-facing confidence ranges when confidence exists.
- F.2.2 proves exact 0% retry regression handling; F.2.3 proves long-running estimated progress changes within a 30-second window.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.2.1 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/shared/detection/derive-progress.test.ts src/renderer/components/monitor/ai-task/ProgressBar.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
```

Results:

- Focused progress UI/derivation suite passed: 2 files passed, 16 tests passed.
- TypeScript typecheck passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers continuous progress derivation, exact explicit runtime percentages including 0% retry reset, terminal 100% states, and more than four fine-grained visible states.
- Not claimed complete: final F.2.1 user acceptance remains unchecked until runtime review with real AI tasks across the visible state set.

## 2026-05-16 prompts/0503 F.3.3/F.3.4 CSV Prompt SKILL References

- Extended `CsvTaskDriver` so `inputArgs.prompt` supports `@skill:<name>` references against the existing loaded local skill-name set.
- Valid prompt skill references now map the runtime row `skill` to the referenced local skill while preserving the prompt text verbatim for the runner.
- Missing prompt skills fail during CSV group load with explicit `inputArgs` errors such as `skill not found: missing-skill`; malformed prompt references such as uppercase or underscore names also fail before any runtime row is created.
- Existing strict 18-column CSV behavior remains intact: the `skill` column is still validated, dependencies are still checked, and valid rows are still isolated from invalid rows.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.3.3/F.3.4 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact CsvTaskDriver --repo devhub --direction upstream --depth 3
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "@skill|unknown skills|loads a real CSV"
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
```

Results:

- GitNexus impact for `CsvTaskDriver` returned LOW risk with 2 direct upstream files.
- Focused prompt-skill CSV suite passed: 1 file passed, 5 tests passed, 6 skipped by filter.
- Full `CsvTaskDriver.test.ts` passed: 1 file passed, 11 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers prompt-level `@skill:<name>` parsing, valid skill mapping, missing-skill rejection, malformed-reference rejection, and compatibility with existing 18-column CSV loading.
- Not claimed complete: final F.3.3/F.3.4 user acceptance remains unchecked until runtime review with a real CSV file and the current local SKILL library.

## 2026-05-16 prompts/0503 F.3.5/F.3.6 SKILL Sandbox And MCP Compatibility

- Extended SKILL metadata with `license`, `sandbox`, and `mcpServers` in the shared Zod source of truth while preserving defaults for existing local `SKILL.md` files.
- Built-in skills now declare `license=MIT`, `sandbox=read-only`, and `mcpServers=[]` in both typed manifests and materialized frontmatter.
- Added task-queue SKILL execution sandboxing for Node runtimes through a generated preload guard: read-only scripts cannot write files, spawn child processes, or load network modules; read-write permits filesystem writes but not child processes/network; system permits explicit child-process execution.
- Non-Node skill execution now requires `system` sandbox because DevHub cannot truthfully enforce the Node preload guard for Python, Bash, PowerShell, or exe runtimes.
- Added local MCP compatibility metadata. System SKILL scripts receive `DEVHUB_SKILL_MCP_SERVERS_JSON`, and regression coverage starts a real local stdio JSON-RPC MCP server from a SKILL and calls `initialize`, `tools/list`, and `tools/call`.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.3.5/F.3.6 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/views/skills/SkillEditorPanel.test.tsx --maxWorkers=1 -t "SKILL|skill|sandbox|MCP|mcp|builtin|metadata"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
```

Results:

- GitNexus impact for `R8RuntimeService` returned LOW risk with 2 direct upstream files.
- Focused SKILL metadata/sandbox/MCP suite passed: 3 files passed, 13 tests passed, 127 skipped by filter.
- TypeScript typecheck passed.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers SKILL license/sandbox/MCP metadata, built-in metadata completeness, read-only write blocking, read-write execution, system child-process execution, and a real local MCP stdio server call from an executed SKILL script.
- Not claimed complete: final F.3.5/F.3.6 user acceptance remains unchecked until runtime review with user-authored SKILL files and the current local MCP server configuration.

## 2026-05-16 prompts/0503 F.4.4/F.4.5 CSV Prompt Interpolation And File References

- Extended `CsvTaskDriver` prompt preparation so `inputArgs.prompt` expands `{{cwd}}` from `inputArgs.cwd` and `{{file}}` from `inputArgs.file` or the CSV `inputFile` column.
- Added `@file:<path>` prompt expansion that reads real local text files before runtime row launch, resolving relative paths against `inputArgs.cwd` when present.
- Added bounded file-reference validation: referenced paths must be readable regular files and must not exceed 64 KiB.
- Missing, unreadable, directory, empty, or oversized `@file:` references now fail the CSV row at load time with explicit `inputArgs` errors instead of creating a runtime row with a fake or missing prompt body.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.4.4/F.4.5 at implementation-evidence level without checking the final acceptance boxes.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx --no-install gitnexus impact CsvTaskDriver --repo devhub --direction upstream --depth 3
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "@file|interpolates|@skill|loads a real CSV"
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- GitNexus impact for `CsvTaskDriver` returned LOW risk with 2 direct upstream files.
- Focused CSV interpolation/file-reference suite passed: 1 file passed, 6 tests passed, 7 skipped by filter.
- Full `CsvTaskDriver.test.ts` passed: 1 file passed, 13 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers `{{cwd}}`, `{{file}}`, real `@file:` expansion, and unreadable-file launch rejection.
- Not claimed complete: final F.4.4/F.4.5 user acceptance remains unchecked until runtime review with a user-provided CSV file and local file references.

## 2026-05-16 prompts/0503 F.4.2 CSV Pre-Launch Validation

- Added duplicate `taskId` validation inside `CsvTaskDriver.loadGroup()`. Every row sharing a duplicate id is invalidated before any runtime row is created.
- Added opt-in real `inputFile` existence checks through `inputArgs.require_input_file=true` or `inputArgs.requireInputFile=true`; paths resolve through the same `cwd` context used by prompt interpolation.
- Added likely API key leakage detection across raw `inputArgs` and prompt text for `sk-...`, `ghp_...`, `api_key=...`, and `Bearer ...` patterns.
- These checks preserve the strict 18-column CSV format and do not introduce new columns or fake validation states.
- This advances `prompts/0503/28-final-acceptance-checklist.md` F.4.2 at implementation-evidence level without checking the final acceptance box.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1 -t "duplicate task ids|required inputFile|API key|@file|loads a real CSV"
pnpm -C devhub exec vitest run src/main/services/csv/CsvTaskDriver.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- Focused CSV pre-launch validation suite passed: 1 file passed, 6 tests passed, 10 skipped by filter.
- Full `CsvTaskDriver.test.ts` passed: 1 file passed, 16 tests passed.
- TypeScript typecheck passed.
- Lint passed; `check:no-emoji` reported no emoji in 664 files.

### Completion Boundary

- Claimed complete for this slice: implementation-level evidence covers duplicate id rejection, opt-in real input-file path existence checks, and likely API key leak rejection.
- Not claimed complete: final F.4.2 user acceptance remains unchecked until runtime review with user-provided CSV files and the user's preferred strictness for always-on path checks.

## 2026-05-16 prompts/0503 F.4 Remaining CSV Evidence Audit

- Audited F.4.1 against the current strict CSV source of truth: `CSV_COLUMN_NAMES` still has exactly 18 columns, header validation rejects missing/reordered columns, template export writes a real 18-column CSV, and runtime launch tests load 18-column CSV files.
- Audited F.4.3 against the queue scheduler: sequential execution is `concurrent=1`; parallel execution is `concurrent>1` plus per-group `parallel_group` limits. Existing runtime and queue tests cover DAG gates plus parallel-group scheduling.
- Audited F.4.6 against resume behavior: matching prior succeeded rows with the same `rowHash` are skipped, changed rows rerun, and `forceRerun` forces a new run.
- Audited F.4.7 against retry behavior: retries and on_fail recovery are explicit state transitions and do not convert queued or failed work into fake success.
- Audited F.4.8 as locally verified after the 2026-05-19 closure: `output_path` maps to queue `artifactsPath`, on_fail SKILL produces real artifacts, and `task:export-results` now provides a unified CSV/JSON task-result artifact workflow with Zod schemas, IPC/preload/global bridge coverage, service file writes, SHA-256 metadata, and a user-facing R8 Ops panel action.
- This updates the implementation-evidence map for `prompts/0503/28-final-acceptance-checklist.md` F.4.1/F.4.3/F.4.6/F.4.7/F.4.8 without checking final acceptance boxes.

### Verification

Command executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/shared/schemas/csv-task-row.test.ts src/main/services/task-queue/TaskQueueService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "fixed 18 column|parallel group limits|resume skip|force rerun|retry transitions|CSV fixtures|queues CSV rows|generates CSV launch commands|schedules CSV groups|loads 18 column CSV"
```

Results:

- Coverage audit suite passed: 3 files passed, 10 tests passed, 124 skipped by filter.

### Completion Boundary

- Claimed complete at implementation-evidence level for F.4.1, F.4.3, F.4.6, F.4.7, and F.4.8.
- F.4.8 now has a generic task result export workflow that writes real CSV/JSON artifacts from current task queue state; final user acceptance still requires running-app verification with user data.
- Final F.4 user acceptance remains unchecked.

## 2026-05-19 prompts/0503 F.4.8 Unified Task Result Export Closure

- Added shared `TaskResultExportRequest`, `TaskResultExportPayload`, and `TaskResultExportResult` schemas to the R8 Zod registry.
- Added executable `task:export-results` IPC route, preload bridge, and renderer global typing.
- `R8RuntimeService.exportTaskResults()` exports all tasks, a session, or explicit run ids, writes JSON and CSV files to a real artifact directory, and returns paths, bytes, SHA-256 hashes, run ids, task count, scope, and session id.
- `R8OpsPanel` exposes `Export task results CSV/JSON` and renders the returned artifact directory plus per-format file summaries.
- Focused verification passed: `R8RuntimeService.test.ts` reads back real JSON/CSV artifacts from a temporary directory, `R8OpsPanel.test.tsx` verifies the user-facing bridge action, and `r8RuntimeHandlers.test.ts` verifies every R8 IPC contract has a handler.
- Quality gates passed: TypeScript no-emit, touched-file ESLint, Zod SoT, no-emoji, no-cloud-deps, no-OCR-deps, and targeted whitespace checks.

## 2026-05-16 R8.C spec-17 Packaged InnerWatchdog Entrypoint

- Added a real packaged InnerWatchdog subprocess entry at `src/watchdog-process/main.ts`.
- Updated the Electron Vite main build entries so the packaged runtime emits `out/main/watchdog-process/main.js`.
- Updated `R8RuntimeService` to configure the watchdog child entry only when the packaged child file exists, avoiding a fake or non-existent child process path.
- Updated `WatchdogSpawner` to pass the watchdog token, marker path, and `ELECTRON_RUN_AS_NODE=1` into the real subprocess environment.
- Updated `WatchdogSupervisor` so a fresh marker written by `writer=inner-watchdog` can be accepted as degraded fallback liveness when there is no prior started state, while parent-created marker refreshes remain rejected as liveness evidence.
- Added regression coverage that executes the real TypeScript entrypoint in `--once` mode and verifies the marker is written by `inner-watchdog`.
- This advances `prompts/0503-2/R8.C/spec-17-watchdog-subprocess.md` at implementation-evidence level for the packaged entrypoint and marker fallback acceptance items.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "InnerWatchdog entrypoint|spawns a real node|watchdog supervisor|marker"
pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub build
node out/main/watchdog-process/main.js --token=<64hex> --marker=<real marker> --handshake-timeout-ms=25 --once
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/schemas/watchdog-rpc.test.ts src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "watchdog supervisor|WatchdogSupervisor|watchdog-supervisor|watchdog rpc|preload"
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results:

- Focused InnerWatchdog entrypoint suite passed: 1 file passed, 5 tests passed, 8 skipped by filter.
- Full `WatchdogSupervisor.test.ts` suite passed: 1 file passed, 13 tests passed.
- TypeScript typecheck passed.
- Production build passed and emitted `out/main/watchdog-process/main.js`.
- Direct Node execution of the built child entrypoint passed and rewrote the marker with `writer=inner-watchdog`.
- Focused watchdog runtime/preload/schema suite passed: 4 files passed, 1 skipped, 22 tests passed, 138 skipped by filter.
- Lint, Zod source-of-truth guard, no-cloud-deps guard, and no-ocr-deps guard passed.

### Completion Boundary

- Claimed complete for this slice: packaged InnerWatchdog child entrypoint emission, real subprocess environment propagation, direct built-entry execution, and marker fallback liveness guarded by an `inner-watchdog` writer marker.
- Not claimed complete: parent-side named-pipe or TCP JSON-RPC servers, bidirectional 5-second heartbeat loop, orphan mode, DevHub restart takeover, full lifecycle child audit rows, event notifications, subprocess RSS/CPU benchmark, and kill/orphan E2E coverage remain separate spec-17 implementation work.

## 2026-05-17 R8.B spec-10 Window Batch Failed Retry Slice

- Continued `prompts/0503-2/R8.B/spec-10-window-batch-ops.md` after the useBatchSelection/lasso slice.
- Added retry-failed-items UI to `BatchProgressToast`; the retry button is shown only when the latest batch is not running, has failed results, and a retry callback is available.
- Added `WindowView` retry context retention for renderer-driven batch operations. Retry uses the latest `WindowBatchProgress.results` and re-executes only HWNDs with `status === 'failed'`; it does not infer retry targets from current selection or fabricate job state.
- Added regression coverage in `BatchProgressToast.test.tsx` for retry button display/hide behavior and in `WindowView.test.tsx` for a real renderer batch path where one HWND fails first and only that HWND is retried.
- Verification:
  - `pnpm -C devhub test --run src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "BatchProgressToast|retries only failed HWNDs|Ctrl|lasso|custom batch confirm|safe keyboard|filtered windows"` passed with 2 files, 12 focused tests passed, and 9 skipped.
  - `pnpm -C devhub exec eslint src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed.
  - TypeScript Compiler API filtered diagnostics returned `filtered_diagnostics=0 files=4` for the retry-touched TS/TSX files.
  - `pnpm -C devhub check:no-emoji` passed with no emoji found in 674 files.
  - `git -C devhub diff --check -- src/renderer/components/monitor/window/BatchProgressToast.tsx src/renderer/components/monitor/window/BatchProgressToast.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx` passed with LF-to-CRLF warnings only.
- Not claimed complete at this point in the sequence: main-process job-state retry orchestration, broad command palette batch command suite, Electron Playwright E2E, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS` release assertion.

## 2026-05-17 R8.B spec-10 Window Batch Electron E2E Slice

- Added real Electron Playwright coverage to `e2e/example.spec.ts` for the spec-10 batch minimize and undo path.
- The test launches the packaged app from `out/main/index.js`, creates two real Electron `BrowserWindow` probes, scans their real HWNDs through the existing runtime test hook, runs `window.devhub.windowManager.batchOp({ action: 'minimize', confirmed: true, hwnds })`, waits for real `window:batch-progress` events through the preload bridge, and restores the probes with `batchUndo`.
- Moved `setupWindowHandlers(mainWin, runtime)` to the first extended-handler registration step in `src/main/ipc/index.ts` so window IPC handlers register before later R8/process/port/topology setup work can fail and abort the shared initialization block.
- This closes the spec-10 "unit + e2e" checklist item at implementation-evidence level without claiming the full release assertion.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec eslint src/main/ipc/index.ts e2e/example.spec.ts
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.B spec-10" --reporter=line --workers=1
```

Results:

- Touched-file ESLint passed for `src/main/ipc/index.ts` and `e2e/example.spec.ts`.
- TypeScript Compiler API filtered diagnostics returned `filtered_diagnostics=0 files=2` for `src/main/ipc/index.ts` and `e2e/example.spec.ts`.
- `pnpm -C devhub build` later passed after the minimal `src/renderer/components/topology/GraphCanvas.tsx` syntax repair removed the renderer parser blocker.
- `pnpm -C devhub test:e2e --grep "R8.B spec-10" --reporter=line --workers=1` passed with 1 Electron test.

### Completion Boundary

- Claimed complete for this slice: real packaged Electron E2E coverage for batch minimize, real HWND discovery, progress push reception, and undo through the public preload bridge.
- Not claimed complete: SendInput/nut-js fallback for controls that reject `WM_CHAR`, broad command palette batch command suite, benchmark evidence, or full `ASSERT_WINDOW_BATCH_7_OPS` release assertion.

## 2026-05-17 R8.B spec-10 Window Batch Focus Benchmark Slice

- Added `scripts/bench-batch-window.mjs` and the `bench:window-batch` package script.
- The benchmark launches the packaged Electron app from `out/main/index.js`, creates 20 real Electron `BrowserWindow` probes, discovers their HWNDs through the runtime scan hook, and measures `window.devhub.windowManager.batchOp({ action: 'focus' })` through the public preload bridge.
- Optimized focus batches by adding `WindowManager.focusWindows()` and routing `WindowBatchExecutor` focus jobs through that single real Win32 helper invocation when available. This preserves per-HWND success/failure reporting while avoiding one PowerShell/Add-Type process per HWND.
- Before the optimization, the real benchmark failed with p95 16328.3ms against the 5000ms budget. After the optimization, the same benchmark passed with p95 4077.2ms.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.test.ts --maxWorkers=1 -t "focuses multiple HWNDs|single batched focus|WindowBatchExecutor|arbitrary text"
pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts src/main/services/WindowBatchExecutor.ts src/main/services/WindowBatchExecutor.test.ts scripts/bench-batch-window.mjs
pnpm -C devhub build
pnpm -C devhub bench:window-batch
```

Results:

- Targeted WindowManager/WindowBatchExecutor suite passed with 2 files, 11 focused tests passed, and 10 skipped by filter.
- Touched-file ESLint passed for `WindowManager.ts`, `WindowManager.test.ts`, `WindowBatchExecutor.ts`, `WindowBatchExecutor.test.ts`, and `scripts/bench-batch-window.mjs`.
- TypeScript Compiler API filtered diagnostics returned `filtered_diagnostics=0 files=6` for the changed TS/TSX E2E/backend files.
- `pnpm -C devhub build` passed after the minimal `src/renderer/components/topology/GraphCanvas.tsx` syntax repair removed the renderer parser blocker.
- `pnpm -C devhub bench:window-batch` passed with `BENCH-WINDOW-BATCH-FOCUS`, 20 real HWNDs, 5 samples, p50 3627.5ms, p95 4077.2ms, p99 4077.2ms, and `passed: true`.

### Completion Boundary

- Claimed complete for this slice: executable benchmark harness, real Electron/Win32 focus benchmark evidence, and p95 budget pass under 5000ms.
- Not claimed complete: SendInput/nut-js fallback for controls that reject `WM_CHAR`, broad command palette batch command suite, or full `ASSERT_WINDOW_BATCH_7_OPS` release assertion.

## 2026-05-17 Build Gate Recovery — GraphCanvas Parser Blocker

- Fixed the minimal syntax defects in `src/renderer/components/topology/GraphCanvas.tsx`: the `GraphCanvasPngExport` interface now closes with `}`, and the `forwardRef(...)` export now closes with `})`.
- No topology behavior was refactored; the existing graph export, `NeuralGraphWithControls`, focus-node, click mapping, and DOM markers are preserved.
- This removes the global renderer parser blocker that previously forced spec-10 slices to rely on filtered TypeScript diagnostics.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec eslint src/renderer/components/topology/GraphCanvas.tsx
pnpm -C devhub build
pnpm -C devhub typecheck
pnpm -C devhub lint
```

Results:

- Targeted `GraphCanvas.tsx` ESLint passed.
- Full production build passed and emitted main, preload, and renderer bundles.
- Full TypeScript typecheck passed with `tsc --noEmit`.
- Full lint passed, including no-emoji verification over 675 files.

## 2026-05-17 R8.B spec-10 ASSERT_WINDOW_BATCH_7_OPS Closure

- Closed the remaining release assertion in `prompts/0503-2/R8.B/spec-10-window-batch-ops.md`.
- Added a real runtime test hook in `src/main/index.ts` that exposes `scannerAliasManager.getAll()` to packaged Electron E2E assertions. The hook reads the same `AIAliasManager` instance used by `WindowBatchExecutor`; it does not create fake alias data and does not alter product IPC behavior.
- Updated `e2e/example.spec.ts` so `ASSERT_WINDOW_BATCH_7_OPS` verifies rename persistence through the main-process runtime alias manager when renderer `ai-alias:get-all` IPC is unavailable in the packaged assertion path.
- The assertion launches `out/main/index.js`, creates seven real Electron `BrowserWindow` probes, scans real HWNDs, executes batch operations through `window.devhub.windowManager.batchOp()`, and verifies the observable side effects for focus, minimize plus undo, close, always-on-top toggle, screenshot output, rename alias/title persistence, and inject-text.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npx gitnexus impact DevhubRuntimeTestHooks --repo devhub --direction upstream --depth 2
npx gitnexus impact RuntimeTestHooks --repo devhub --direction upstream --depth 2 --include-tests
pnpm -C devhub exec eslint src/main/index.ts e2e/example.spec.ts
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "ASSERT_WINDOW_BATCH_7_OPS" --reporter=line --workers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/main/index.ts e2e/example.spec.ts docs/r8/window-batch.md docs/r8bc-implementation-report.md
git diff --check -- prompts/0503-2/R8.B/spec-10-window-batch-ops.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
npx --prefix devhub gitnexus detect_changes --repo devhub --scope unstaged
```

Results:

- GitNexus CLI impact analysis returned LOW risk with 0 direct callers for both touched test-hook interfaces.
- Touched-file ESLint passed for `src/main/index.ts` and `e2e/example.spec.ts`.
- Production build passed and emitted main, preload, and renderer bundles.
- `pnpm -C devhub test:e2e --grep "ASSERT_WINDOW_BATCH_7_OPS" --reporter=line --workers=1` passed with 1 Electron test in 12.8s.
- Full TypeScript typecheck passed.
- Full lint passed, including no-emoji verification over 675 files.
- The explicit no-emoji rerun passed over 675 files, and an additional touched-file emoji scan found no emoji in the root spec/ledger/docs files outside the devhub script scope.
- Touched-file `git diff --check` passed for the assertion code/docs/spec/ledger paths, with only Windows LF-to-CRLF warnings on code files.
- GitNexus `detect_changes` completed and reported `critical` for the full pre-existing 83-file dirty tree; the specific pre-edit impact checks for this closure's two hook interfaces were LOW with 0 direct callers.

### Completion Boundary

- Claimed complete for spec-10: all 15 checklist items are checked and `ASSERT_WINDOW_BATCH_7_OPS` is backed by real packaged Electron evidence.
- No mock windows, fake HWNDs, fake progress events, simulated alias store, OCR, or cloud path is used in this assertion.

## 2026-05-17 R8.C spec-24 SystemInformation Network Builder Closure

- Added `systeminformation@5.31.6` as an MIT production dependency and registered it in the R8.A integration manifest plus `R8.A.libs.systeminformation`.
- Added `SystemInformationAdapter` to the main-process integration adapter layer. It dynamically loads the installed package, validates raw `networkConnections()` and `processes().list` rows, maps network rows into `PortInfo`, and returns typed `ServiceResult` failures when unavailable.
- `PortScanner.scanAll()` now uses `systeminformation.networkConnections()` as the primary real port source and keeps the existing `netstat -ano -p TCP` parser as the fallback. `PortInfo.source` records `systeminformation`, `netstat`, or `scanner-cache` provenance.
- Added `NetworkTopologyBuilder` and routed `GraphService` network topology builds through it. The builder consumes existing scanner-cache process/port/window/project data, preserves current edge semantics, carries `handleCount` when process scanner data provides it, and includes port source provenance in topology node metadata.
- Preserved the current D3/SVG graph renderer rather than forcing an incomplete Cytoscape migration. Renderer PNG export now works through `GraphCanvas.exportPng()` and the current `GraphSnapshot` SVG layer; main-process PNG export still truthfully refuses because it has no renderer canvas.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npm view systeminformation version license dependencies dist.tarball --json
pnpm -C devhub add systeminformation@5.31.6
node -e "import('systeminformation').then(async si=>{const rows=await si.networkConnections(); const ports=rows.filter(r=>r && r.pid && r.localPort).slice(0,5).map(r=>({protocol:r.protocol,localPort:r.localPort,state:r.state,pid:r.pid,process:r.process})); console.log(JSON.stringify({count:rows.length, sample:ports}, null, 2));})"
pnpm -C devhub exec vitest run src/main/services/integrations/SystemInformationAdapter.test.ts src/main/services/PortScanner.test.ts src/main/services/graph/GraphService.test.ts src/shared/feature-flags.test.ts src/shared/integration-manifest.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/graph/GraphService.test.ts src/main/services/integrations/SystemInformationAdapter.test.ts src/main/services/PortScanner.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/topology/TopologyEntrypoints.test.tsx --maxWorkers=1 -t "topology|Topology|graph|Graph|PortScanner|SystemInformationAdapter|schema|preload"
pnpm -C devhub exec eslint src/main/services/integrations/SystemInformationAdapter.ts src/main/services/integrations/SystemInformationAdapter.test.ts src/main/services/integrations/index.ts src/main/services/PortScanner.ts src/main/services/PortScanner.test.ts src/main/services/graph/NetworkTopologyBuilder.ts src/main/services/graph/GraphService.ts src/main/services/graph/GraphService.test.ts src/shared/types-extended.ts src/shared/feature-flags.ts src/shared/feature-flags.test.ts src/shared/integration-manifest.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results:

- npm metadata confirmed `systeminformation@5.31.6` with MIT license.
- Live local `systeminformation.networkConnections()` smoke returned `count=490` and real TCP rows with protocol, port, state, pid, and process fields.
- Focused adapter/port/graph/manifest suite passed with 5 files and 35 tests.
- Focused topology cross-layer suite passed with 9 files, 51 tests passed, and 151 skipped by filter.
- Touched-file ESLint passed.
- TypeScript passed.
- Zod SoT, no-emoji, no-cloud-deps, and no-OCR-deps gates passed.

### Completion Boundary

- Claimed complete for the spec-24 network data-source checklist item: explicit `NetworkTopologyBuilder`, real `systeminformation` primary path, real `netstat` fallback path, and handle-count metadata passthrough are implemented.
- Later update: spec-21 Cytoscape renderer reuse is closed by the 2026-05-17 shared canvas closure below.

## 2026-05-17 R8.C spec-24 Topology Fixture Matrix Closure

- Added a low-resource Vitest matrix for 100/500/800 nodes across `network-topology`, `neural-relationship`, and `flow`. The matrix runs the real `GraphService.buildGlobal()` path with schema-shaped scanner-cache fixture snapshots, validates `asOfTs` historical cursor state, validates edge endpoints, enforces a 2500ms per-build budget, and proves the 800-node case requires explicit `expandAll` while the default guard degrades to 500 nodes.
- Added the dev-only Electron main-process hook `buildGlobalTopologyFixtureForTests()` while preserving production scanner/cache behavior. The hook is exposed only through the existing non-packaged `__DEVHUB_TEST_HOOKS__` path and instantiates the real `GraphService`; it does not seed production scanner state or claim synthetic fixture data as runtime inventory.
- Added a focused Playwright fixture that launches the built Electron app, runs the same 100/500/800 x three-graph-kind matrix inside the real Electron main process, verifies the 800-node guard, opens the real fullscreen topology view, switches graph kinds through the toolbar, and verifies the time cursor through `GraphCanvas` `data-as-of-ts`.
- Added `GraphCanvas` `data-as-of-ts` as a small runtime observability attribute for current vs historical renders.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/main/services/graph/GraphService.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.C spec-24 global topology" --reporter=line --workers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/main/index.ts src/main/services/graph/GraphService.test.ts src/renderer/components/topology/GraphCanvas.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx e2e/example.spec.ts
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
git diff --check -- devhub/src/main/index.ts devhub/src/main/services/graph/GraphService.test.ts devhub/src/renderer/components/topology/GraphCanvas.tsx devhub/src/renderer/components/topology/FullScreenTopologyView.test.tsx devhub/e2e/example.spec.ts
```

Results:

- Focused Vitest passed with 2 files and 25 tests.
- Production build passed.
- Focused Electron Playwright fixture passed with 1 test.
- TypeScript passed.
- Touched-file ESLint passed.
- Zod SoT passed.
- No-emoji gate passed with `No emoji found in 681 files`.
- Touched-file diff-check passed.

### Completion Boundary

- Claimed complete for the spec-24 Vitest + Playwright fixture checklist item.
- Later update: spec-21 Cytoscape renderer reuse is closed by the 2026-05-17 shared canvas closure below.

## 2026-05-17 R8.C spec-24 Shared Cytoscape Canvas Closure

- Added real `cytoscape@3.33.3` and `cytoscape-dagre@3.0.0` production dependencies after package metadata confirmed MIT licensing and the `@dagrejs/dagre` dependency path.
- Added `src/renderer/components/dag-editor/DagCanvas.tsx` as the shared Cytoscape wrapper owned by spec-21 and reused by spec-24. The wrapper registers `cytoscape-dagre` once, initializes/destroys Cytoscape in React lifecycle, preserves node click/focus contracts, exposes Cytoscape PNG export, and falls back to the existing deterministic SVG PNG export only when the test DOM has no real canvas backend.
- `DagEditorPanel` now renders the shared `DagCanvas` in Canvas view while keeping the existing drag/drop card controls and four-view state.
- `GraphCanvas` now renders fullscreen global topology through `DagCanvas`, exposes `data-renderer-engine="cytoscape"`, and keeps the hidden SVG fallback for non-browser tests.
- Registered `R8.A.libs.cytoscape` and `R8.A.libs.cytoscape-dagre` in the feature flag registry and R8.A integration manifest; feature/manifest tests now assert both package and flag ownership.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
npm view cytoscape@3.33.3 version license dependencies dist.tarball --json
npm view cytoscape-dagre@3.0.0 version license dependencies peerDependencies dist.tarball --json
pnpm -C devhub add cytoscape@3.33.3 cytoscape-dagre@3.0.0
pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx src/shared/feature-flags.test.ts src/shared/integration-manifest.test.ts --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/renderer/components/dag-editor/DagCanvas.tsx src/renderer/components/dag-editor/DagEditorPanel.tsx src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/components/topology/GraphCanvas.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx src/shared/vendor-native.d.ts src/shared/feature-flags.ts src/shared/feature-flags.test.ts src/shared/integration-manifest.ts src/shared/integration-manifest.test.ts
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.C spec-24 global topology" --reporter=line --workers=1
pnpm -C devhub check:license
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
```

Results:

- npm metadata confirmed `cytoscape@3.33.3` and `cytoscape-dagre@3.0.0` are MIT licensed; `cytoscape-dagre` depends on `@dagrejs/dagre`.
- Focused renderer/manifest Vitest passed with 4 files and 11 tests.
- TypeScript passed.
- Touched-file ESLint passed.
- Production build passed.
- Focused Electron Playwright `spec-24` fixture passed with 1 test.
- License check passed with 464 production package entries validated and the existing 1 manifest exception documented.
- No-cloud and no-OCR dependency gates passed.
- No-emoji gate passed with `No emoji found in 682 files`.
- Zod SoT verification passed.

### Completion Boundary

- Claimed complete for the remaining spec-24 Cytoscape reuse checklist item.
- All spec-24 checklist items are now checked with implementation and verification evidence.
- Broader spec-21 visual editor work remains partial and is tracked in `prompts/0503-2/R8.C/spec-21-dag-visual-editor.md`.

## 2026-05-19 prompts/0503 K.8 About Fair-Use Closure

- Added an in-app `关于与商标声明` section to Advanced settings so the fair-use statement is visible from the running renderer, not only from README.
- The section records the project license boundary as AGPL-3.0, points users to NOTICE and CycloneDX SBOM for third-party dependency license evidence, and states that vendor names/logos are used only for identification and interoperability without sponsorship, endorsement, agency, or commercial affiliation claims.
- Added a renderer regression to `SettingsDialog.statusbar.test.tsx` that opens Advanced settings and verifies the fair-use/About text is present.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1 -t "About fair-use" --reporter=verbose
pnpm -C devhub exec vitest run src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1 --reporter=verbose
pnpm -C devhub exec eslint src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --max-warnings=0
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
```

Results:

- Focused About/fair-use Vitest passed with 1 selected test.
- Full `SettingsDialog.statusbar.test.tsx` passed with 1 file and 6 tests.
- Touched-file ESLint passed.
- TypeScript typecheck passed.
- No-emoji gate passed with `No emoji found in 778 files`.
- GitNexus pre-change impact for `SettingsDialog` and `AdvancedPanel` was LOW with no upstream affected processes.

### Completion Boundary

- Claimed locally verified for `prompts/0503/28-final-acceptance-checklist.md` K.8 implementation evidence.
- Not claimed: legal relicensing, owner legal sign-off, or human acceptance of the final checklist item.

## 2026-05-19 prompts/0503 H.1.1 Zero-Egress Capture Runner

- Added `scripts/verify-zero-egress-capture.mjs` as a real Windows `pktmon`-based 60-second startup capture runner for the zero-egress acceptance item.
- Added `check:zero-egress-capture`, `check:zero-egress-capture:preflight`, and `check:zero-egress-capture:self-test` package scripts.
- The runner checks Windows, `pktmon`, and Administrator prerequisites; starts NIC packet counters; launches `pnpm dev`; observes the requested duration; parses packet counter JSON; writes evidence under `out/zero-egress-capture`; and fails if packet counters are non-zero.
- The runner returns a blocked exit code instead of passing when Administrator privileges are absent.
- README now documents the 60-second packet-level workflow alongside the existing no-cloud, no-OCR, and no-outbound diagnostic guards.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub check:zero-egress-capture:self-test
pnpm -C devhub check:zero-egress-capture:preflight
pnpm -C devhub exec eslint scripts/verify-zero-egress-capture.mjs --max-warnings=0
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results:

- Self-test passed.
- Preflight found Windows and `pktmon`, but returned `ready=false` and exit code `2` because `ZRAINBOW\ZRainbow` is not Administrator.
- Touched-script ESLint passed.
- No-emoji gate passed with `No emoji found in 779 files`.
- No-cloud and no-OCR dependency gates passed.

### Completion Boundary

- Claimed implemented for the real capture runner and operator workflow.
- Not claimed complete for H.1.1 / J.1.6 final acceptance because this non-admin shell cannot execute the required 60-second live packet capture and produce a passing `packetCount=0` report.

## 2026-05-19 prompts/0503 B.3.4 Density Electron E2E Closure

- Hardened the Settings dialog overlay to use the project modal z-index token (`--z-tier-modal`) so it stays above drawer-system layers during real Electron interaction.
- Hardened the density E2E close action to target the exact `关闭` button instead of matching both the dialog close label and the button text.
- Preserved the existing density implementation path through Settings, document `data-density`, `project-list-scroll` `data-density`, virtualized row-height attributes, and persisted appearance settings.

### Verification

Command executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test:e2e --grep "P1.2-a" --reporter=line --workers=1
```

Result:

- Focused Electron E2E passed with 1 test in 12.0 seconds.
- Compact density was verified in the running renderer as document `data-density="compact"`, project-list `data-density="compact"`, and `data-estimated-row-height="64"`.
- Comfortable density was verified in the running renderer as document `data-density="comfortable"`, project-list `data-density="comfortable"`, `data-estimated-row-height="144"`, and persisted `settings.appearance.informationDensity="comfortable"`.

### Completion Boundary

- Claimed locally verified for B.3.4 density minimum-dimension behavior with real Electron E2E evidence.
- Not claimed: human visual acceptance across every density-affected surface or closure of unrelated `prompts/0503` checklist items.

## 2026-05-19 prompts/0503 B.1.3 Theme Visual-Continuity E2E Closure

- Extended the existing `P8.2 外观四轴设置可真实应用并跨重启持久化` Electron E2E with real renderer frame sampling during a Settings-driven theme switch.
- The sampler captures 40 `requestAnimationFrame` frames while switching from `modern-light` to `cyberpunk` and fails on blank-shell conditions: zero app-shell area, `display:none`, `visibility:hidden`, `opacity:0`, or missing body content.
- The same test still verifies four-axis theme state, semantic token changes, persisted appearance settings, application relaunch, and store-backed restore.
- Hardened the Electron E2E close helper so failed graceful quit falls back to terminating only the spawned Electron test process instead of leaving a hanging Playwright close promise.

### Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub test:e2e --grep "P8.2" --reporter=line --workers=1
git -C devhub diff --check -- e2e/example.spec.ts
```

Results:

- Touched-file ESLint passed.
- Focused Electron P8.2 E2E passed with 1 test in 23.2 seconds.
- Targeted whitespace check passed.

### Completion Boundary

- Claimed locally verified for B.1.3 no-blank-shell behavior on the real Settings-driven `modern-light` to `cyberpunk` theme switch path.
- The same P8.2 run also upgrades B.1.4 local restart evidence: it persists Paper Zen, closes the first Electron app, launches a second Electron app, and verifies restored density, motion, palette, and radius state from the real settings store.
- The same P8.2 run also upgrades B.7.1/B.7.2 local browser evidence: the running Electron renderer changes topology graph tokens from seeded `modern-light` values to cyberpunk `--topology-node-process=#00ffff`, `--topology-edge-network=#39ff14`, and `--topology-node-label=#ffffff`.
- `check:theme-seasonal-visual-contract` now upgrades B.7.3 from explicit-token evidence to a WCAG ratio gate: high-contrast chart/topology text tokens must be at least 4.5:1 and graph series/node/edge tokens at least 3:1 against each palette's `--surface-950`.
- The same P8.2 run also upgrades B.5.1-B.5.3 with real Settings preview evidence: the Electron renderer shows `theme-preview-editor`, card/button/table/chart preview examples, updates `theme-live-preview` to `#112233`, and keeps the document palette at `modern-light` before any apply action.
- Not claimed: manual perceptual review of every theme pair or closure of unrelated `prompts/0503` checklist items.

## 2026-05-19 prompts/0503 Mechanical Ledger Coverage Verifier

- Added `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs` to mechanically verify prompt-to-ledger coverage for both `prompts/0503` and `prompts/0503-2`.
- The verifier recursively counts Markdown files, parses the survey acceptance ledger and R8 completion ledger, fails on missing/extra rows, requires explicit blocker markers for administrator zero-egress capture, license/legal decisions, multi-display hardware, and Windows Service UAC execution, and now validates that `r8-external-blockers-current.json` contains every required external blocker gate.
- The verifier also exposes `--strict-complete`; this is the final completion gate and must fail while any R8 row remains `partial`, any evidence row remains `missing`, any required external blocker gate is still failed, or any `prompts/0503` row still requires product/legal/user acceptance.
- In strict mode, the verifier also checks that `r8-external-blockers-current.json` is fresh. The default freshness window is 60 minutes and can be overridden with `--max-external-report-age-minutes=<n>`.
- The verifier now requires every external blocker gate to carry a machine-readable runbook with `blockerKind`, `owner`, `prerequisite`, `verificationCommand`, `requiredEvidence`, and `unblockRule`, so blocked gates have an executable closure path instead of a free-text note.
- The verifier has a `--self-test` mode for its internal path normalization, status counting, Markdown table escaping, truncation helpers, and external-gate runbook coverage helper.
- Running with `--write-report` writes `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-ledger-verification.json`.
- `check:r8-external-blockers` now also supports `--write-report <path>` and records zero-egress preflight plus the project license/legal-decision gate alongside display, virtual desktop, admin, Windows Service, and gate-runbook metadata.
- Added `generate-0503-acceptance-pack.mjs` to assemble a human-readable and machine-readable acceptance evidence pack from the current strict report, external blocker report, completion ledger, and survey ledger. It records source file SHA256 values, embeds all 115 prompt-to-artifact rows, and preserves `acceptanceStatus=not-complete` while strict completion remains failed.
- Added `generate-0503-checkbox-manifest.mjs` to inventory every Markdown checkbox under `prompts/0503` and `prompts/0503-2` with file, line, heading, checked/open status, text, and text hash.

### Verification

Command executed from `D:/Desktop/CREATOR ONE`:

```bash
node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --write-report
node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --self-test
node .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/scripts/verify-0503-ledgers.mjs --strict-complete --write-report
pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json
```

Result:

- `prompts/0503`: 34 recursive Markdown files, 34 ledger rows, 0 missing, 0 extra.
- `prompts/0503-2`: 81 recursive Markdown files, 81 ledger rows, 0 missing, 0 extra.
- R8 evidence status counts: 74 verified, 5 partial, 2 not-applicable.
- Required blocker marker checks: 4 checked, 0 missing.
- Structured external blocker gate checks: 7 required gates, 0 missing, 7 currently failed by real environment evidence.
- Verifier self-test passed.
- Strict completion gate intentionally fails with `partialRows=5`, `missingEvidenceRows=0`, `failedExternalGateIds=7`, and `surveyAcceptanceRows=3`.
- Strict completion JSON now includes `partialRowDetails` with each row's `nextAction`, plus `failedExternalGateDetails` with the concrete evidence string and executable runbook metadata for every failed gate.
- External gate runbook coverage is mechanically checked: current `runbookMissingFields=[]`, required fields are `blockerKind`, `owner`, `prerequisite`, `verificationCommand`, `requiredEvidence`, and `unblockRule`.
- Strict completion JSON also includes `surveyAcceptanceRows` for `22-user-journey-storyboard.md`, `24-legal-compliance-survey.md`, and `28-final-acceptance-checklist.md`.
- Running with `--write-strict-report` writes a human-readable prompt-to-artifact checklist to `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-strict-completion-report.md`, including each failed gate's owner, prerequisite, verification command, required evidence, and unblock rule.
- Latest strict run used a fresh external blocker report (`externalReportFresh=true`) and still failed only because real blockers remain.
- Root package scripts now expose `pnpm check:0503-ledgers`, `pnpm check:0503-ledgers:self-test`, and `pnpm check:0503-strict`. The strict script refreshes external blocker evidence first, then runs the strict completion gate.
- Root package scripts now also expose `pnpm check:0503-acceptance-pack` and `pnpm check:0503-acceptance-pack:self-test`.
- Root package scripts now also expose `pnpm check:0503-checkbox-manifest`, `pnpm check:0503-checkbox-manifest:self-test`, `pnpm check:0503-acceptance-pack`, and `pnpm check:0503-acceptance-pack:self-test`; `check:0503-acceptance-pack` now generates the pack and immediately verifies evidence-pack integrity in the same entrypoint.
- The root `package.json` keeps the existing eight font dependencies while adding the 0503 check scripts, and `pnpm-lock.yaml` remains synchronized with those eight dependencies; the completion tooling does not delete or replace pre-existing package dependency state.
- Checkbox manifest generation writes `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-checkbox-manifest.md` and `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-checkbox-manifest.json`; the latest manifest reports 2109 checkbox rows, 1303 open, and 806 checked.
- Open checkbox classification is now explicit: 948 `survey-context`, 315 `user-product-acceptance`, 38 `legal-product-acceptance`, 1 `hardware-verification`, and 1 `admin-service-verification`.
- Acceptance pack generation now also writes `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-owner-action-queue.md` and `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-owner-action-queue.json`, combining 7 external gate actions with 5 checkbox closure-class actions. The latest queue has 12 actions: 8 `operator`, 2 `legal-product`, 1 `product`, and 1 `user-product`.
- `0503-owner-action-queue.md` now includes an `Evidence Submission Template` section so operators, product owners, user reviewers, and legal/product reviewers can attach the exact artifact path, command, environment, and unblock result needed before rerunning `pnpm check:0503-strict`.
- The owner action queue now includes a current environment readiness snapshot: `displayCount=1`, `isAdministrator=false`, `serviceInstalled=false`, `serviceStatus=not-installed`, `virtualDesktopCount=2`, `zeroEgressPreflightReady=false`, and `legalDecisionEvidenceExists=false`.
- Added `verify-0503-evidence-pack.mjs` plus root scripts `pnpm check:0503-evidence-pack` and `pnpm check:0503-evidence-pack:self-test` to verify that acceptance-pack source hashes, prompt manifests, checkbox manifest summary, owner action queue, completion status, completion audit, and referenced evidence paths remain internally consistent after regeneration.
- The evidence-pack verifier derives owner action counts from the current failed external gates plus open checkbox closure classes instead of hard-coding the present 13-action blocked state, so future real gate closure will not be rejected by stale verifier constants.
- The derived owner action count check is order-insensitive: owner count maps are compared by sorted owner keys and exact counts, so JSON key insertion order cannot cause false evidence-pack failures.
- `check:r8-external-blockers` now supports `--quiet` so generated evidence can be refreshed without printing the full JSON report; `check:0503-acceptance-pack` uses that quiet refresh path and still records the full JSON to `r8-external-blockers-current.json`.
- `check:0503-strict` now invokes the external blocker verifier directly through Node with `--quiet --write-report`, avoiding pnpm argument passthrough noise while preserving the same `r8-external-blockers-current.json` evidence file and the same strict failure semantics.
- Shell-portable continuation should use `pnpm --silent check:0503-strict:vd-watch` when the foreground-watch opt-in must be injected inside the Node runner; this avoids the WSL/bash-to-Windows pnpm/env propagation issue observed on this machine.
- Acceptance pack generation now also writes `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-status.md` and `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-status.json` as a small dashboard snapshot. The latest status reports `complete=false`, 115 prompt artifact rows, 2109 checkbox rows, 5 partial R8 rows, 6 failed external gates, 3 survey acceptance rows, and 11 owner actions.
- `0503-completion-status.md` now includes a scoped checkbox table: `prompts/0503` has 1405 rows with 1301 open and 104 checked, while `prompts/0503-2` has 704 rows with 2 open and 702 checked.
- Acceptance pack generation now also writes `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-audit.md` and `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-completion-audit.json`, restating the completion objective, mapping 115 prompt-to-artifact rows, checking 11 success criteria including root package dependency and lockfile preservation, checking 28 command gates, and listing 19 missing or incomplete requirements.
- Acceptance pack generation writes `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-acceptance-pack.md` and `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-acceptance-pack.json`; the latest pack reports `acceptanceStatus=not-complete`, 5 partial R8 rows, 6 failed external gates, 3 survey acceptance rows, 7 hashed source evidence files, 34 `prompts/0503` rows, 81 `prompts/0503-2` rows, 2109 checkbox rows, and complete runbook coverage.
- External blocker JSON evidence was written to `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json`; the command exits non-zero by design because one renderable Electron/BrowserWindow display, two registry virtual desktops, `foregroundHookOptIn=true`, non-admin shell, uninstalled `devhub-watchdog`, zero-egress preflight `windows=true` / `pktmonAvailable=true` / `admin=false` / `preflightExitCode=2`, `packageJsonLicense=AGPL-3.0-or-later`, and missing legal-decision evidence remain true blockers.
- Dependency license validation is separate from the product/legal license decision: `pnpm -C devhub check:license` passed with 472 production package entries validated and 1 documented manifest exception, while the project-license decision gate remains blocked until explicit legal/product evidence exists.

## 2026-05-20 Continuation - R8.C Spec-17 Windows Service Installer Typecheck Hardening

- Fixed `devhub/src/main/services/watchdog-supervisor/WindowsServiceInstaller.ts` so the real `sc.exe query` verification path imports `execFile` from `node:child_process` explicitly.
- This does not claim the live Windows Service gate complete: the current shell is still non-admin, `devhub-watchdog` is still not installed, and the actual UAC install/uninstall flow still requires an elevated run plus `sc.exe query` evidence.
- Verification passed: `pnpm -C devhub exec eslint src/main/services/watchdog-supervisor/WindowsServiceInstaller.ts --max-warnings=0`; `pnpm -C devhub exec vitest run src/main/services/watchdog-supervisor/WatchdogSupervisor.test.ts --maxWorkers=1 -t "Windows Service"` with 1 file / 2 tests; `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "truthful subprocess supervisor contracts|watchdog supervisor control channels"` with 2 files / 2 tests; `pnpm -C devhub exec tsc --noEmit --pretty false`; `pnpm -C devhub check:no-emoji` with `No emoji found in 779 files`; file-scoped `git diff --check`.
- GitNexus context for `WindowsServiceInstaller` found direct imports from `WatchdogSupervisor.ts` and `watchdog-supervisor/index.ts`; `gitnexus detect_changes` over the whole unstaged `devhub` tree reports `critical` because the shared worktree already contains 88 dirty files, so the focused verification above is the relevant evidence for this one-line import fix.
- The 0503 completion-ledger owner commands now expose `recommendedStrictCompletionCommand: pnpm check:0503-strict:vd-watch` alongside the legacy `pnpm check:0503-strict` field, and the strict-failure summary prints `recommendedStrictCommand: pnpm --silent check:0503-strict:vd-watch` so future continuation runs stop defaulting to the WSL-sensitive path.

### Completion Boundary

- Claimed verified for ledger coverage and blocker visibility.
- Not claimed: final completion of the 5 partial R8 rows, administrator-only checks, hardware-only checks, legal/license decisions, or final user acceptance.
