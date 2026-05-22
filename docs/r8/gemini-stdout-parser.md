# R8.C Gemini stdout Parser

Date: 2026-05-06

## Purpose

The Gemini stdout parser converts real Gemini CLI terminal output into DevHub `CliOutputEvent` records while the Gemini CLI remains primarily stdout-oriented. It does not claim external Gemini execution success. It only classifies lines that actually pass through the runtime parser bridge.

## Current Implementation

- `src/shared/schemas/gemini-pattern.ts` defines the shared Zod source of truth for Gemini pattern kinds, reload requests, parser state, and pattern stats.
- `GeminiParser` uses a precompiled rule set with eight default rules covering thinking, bracket tool calls, prose tool calls, tool results, completion, rate limits, safety blocks, and partial text.
- Regex `lastIndex` is reset before every match so global flags cannot leak state across lines.
- ANSI stripping is enabled by default; if stripping ever fails, the parser falls back to the original line.
- Oversized stdout lines are bounded to 16,000 characters before matching; the per-instance partial buffer is capped to the latest 4,096 characters.
- `ai:gemini-pattern-stat` returns per-instance or aggregate counts, unmatched ratio, last kind, tool stack, partial-buffer size, rule version, and applied rule count.
- `ai:gemini-rule-reload` validates rules through the shared Zod schema and applies them without restarting DevHub.
- `startGeminiRuleWatcher()` starts a real chokidar watcher for `userData/gemini-pattern.json`; add/change events read local JSON rules from disk and reuse `reloadGeminiRules()` with an internal `confirmedBy` marker.
- The public preload bridge exposes `window.devhub.r8.ai.geminiPatternStat(instanceId?)` and `window.devhub.r8.ai.reloadGeminiRules(rules, confirmedBy)`.
- `R8.C.shim.gemini` is registered as an enabled, default-on feature flag depending on `R8.C.cli.parser`; `isFeatureEnabled('R8.C.shim.gemini')` returns true without user override.
- The generated Gemini shim is a real passthrough Node shim. It preserves stdout/stderr, sets `GEMINI_OUTPUT_FORMAT=json` when the user has not supplied one, sets `DEVHUB_SHIM_MARKER_PROTOCOL=v1`, and emits `DEVHUB::MARKER::v=1::DONE=...` on child exit through the existing frame pipe.
- `R8RuntimeService.installShim()` routes generated Gemini shim stdout frames through `strategy="line"` because `GeminiParser` is a line parser; non-Gemini shim tools continue to use `strategy="shim"`.
- The packaged Electron Playwright E2E installs the generated Gemini shim through the public preload bridge, executes the generated shim file with the real Node executable, verifies `GEMINI_OUTPUT_FORMAT=json` and `DEVHUB_SHIM_MARKER_PROTOCOL=v1` child env injection, captures the real named-pipe stdout frame path, and receives `cli:event-stream` events for progress, tool-use, and message-out lines.
- `AITaskTracker.subscribeToCliOutputParser()` consumes real Gemini parser events and feeds them into `SignalCollector` as the `cli_parse` channel, preserving Gemini progress and confidence while keeping legacy signal contributions.
- `R8RuntimeService` writes one local audit row with `action="ai:gemini-pattern-low-match-rate"` and `severity="WARN"` when real Gemini stdout parsing drops below a 50% rule match rate after at least five observed lines. The audit is keyed by `instanceId` and parser `ruleVersion` to avoid repeated warnings for the same degraded rule set.
- `R8RuntimeService.checkGeminiStdoutTimeouts()` emits a real `CliOutputEvent` with `eventType="unknown"` and confidence `0.1`, and records a local WARN audit, when a Gemini parse session has no fresh stdout event past the 30-second timeout.

## No-Mock Boundary

- Parser output is derived from real stdout lines supplied to `CLIOutputParser`.
- Rule reload only changes parser rules; it does not simulate a Gemini process restart.
- Pattern stats are calculated from real parser state and start at zero when no lines have been observed.
- External Gemini CLI detection and execution remain separate runtime concerns.

## Boundaries Not Claimed Complete

- This slice does not claim external Gemini CLI task success or a live Gemini account/session. It verifies DevHub's real local parser, shim generation, environment injection, named-pipe bridge, and packaged Electron event-stream path.

## Verification

Commands used for this slice:

```bash
pnpm -C devhub test --run src/main/services/cli-parser/parsers/GeminiParser.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --testNamePattern "Gemini|gemini|validates Gemini|reloads Gemini" --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/parsers/GeminiParser.test.ts src/main/services/R8RuntimeService.test.ts -t "Gemini" --maxWorkers=1
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "Gemini" --maxWorkers=1
pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts --maxWorkers=1
pnpm -C devhub test --run src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/AITaskTracker.test.ts -t "CLI parser subscription|Gemini" --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/services/shim/ShimRegistry.test.ts -t "shim|Gemini" --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts e2e/example.spec.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-02 packaged Codex" --workers=1 --reporter=line
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-04" --workers=1 --reporter=line
```

Results:

- Gemini-focused target suite: 4 files passed, 10 tests passed; 1 file skipped by the focused test pattern.
- 2026-05-15 Gemini runtime watcher suite: 1 file passed, 3 tests passed, including real `gemini-pattern.json` chokidar reload.
- 2026-05-15 Gemini shim suite: 1 file passed, 4 tests passed, including generated Gemini child env injection and DONE marker frame.
- 2026-05-15 Gemini timeout suite: 1 file passed, 4 Gemini runtime tests passed, including one-shot stale stdout `unknown` event and WARN audit.
- 2026-05-15 Gemini WARN audit focused suite: 2 files passed, 9 tests passed, including low-match audit de-duplication.
- 2026-05-15 feature flag suite: 1 file passed, 3 tests passed, including `R8.C.shim.gemini` default-on registry coverage.
- 2026-05-15 SignalCollector bridge suite: 1 file passed, 2 tests passed, including Gemini `cli_parse` ingestion.
- 2026-05-15 touched-file ESLint and `tsc --noEmit --pretty false`: passed.
- 2026-05-15 no-emoji gate: passed; `No emoji found in 622 files`.
- TypeScript typecheck: passed.
- Lint and no-emoji gate: passed; `No emoji found in 575 files`.
- Zod SoT verification: passed.
- 2026-05-15 Gemini shim runtime regression: 2 files passed, 9 tests passed, covering generated Gemini shim stdout frame parsing through `rawSource="line"`.
- 2026-05-15 touched-file ESLint and `tsc --noEmit --pretty false`: passed.
- 2026-05-15 production build: passed; existing Monaco dynamic/static import warning remains non-fatal.
- 2026-05-15 packaged Codex shim regression E2E: 1 test passed.
- 2026-05-15 packaged Gemini shim E2E: 1 test passed; generated Gemini shim preserved stdout, injected env, wrote named-pipe frames, and emitted renderer `cli:event-stream` events for progress, tool-use, and message-out.
