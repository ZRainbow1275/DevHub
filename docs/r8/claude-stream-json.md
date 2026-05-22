# R8.C Claude stream-json Parser

Date: 2026-05-06

## Purpose

The Claude stream-json integration turns real Claude Code NDJSON output into DevHub runtime events without inventing progress. It accepts only schema-valid Claude stream events, keeps malformed lines observable as parser errors, and exposes token/cost data through a typed IPC surface for monitor and signal-fusion consumers.

## Current Implementation

- `src/shared/schemas/claude-stream.ts` defines the shared Zod source of truth for `system`, `assistant`, `user`, `result`, and `partial_assistant` stream-json events.
- `ClaudeParser` validates every NDJSON line through that schema before mapping it into `CliOutputEvent`.
- Claude stream events carry a defaulted `schemaVersion=1` field after Zod parsing so downstream consumers can detect future schema breaks without fabricating a value from raw stdout.
- `assistant` events with `tool_use` become `eventType='tool_invocation'` and preserve tool `name`, `id`, and `input` in the event payload.
- `assistant` and `result` usage objects write `inputTokens` and `outputTokens` into the normalized payload.
- `partial_assistant` frames are merged per `instanceId` with a 100ms throttle window and emitted as `message-out` events.
- `R8RuntimeService` emits schema-valid raw Claude events to `ai:claude-stream-event` and keeps the existing generic `cli:event-stream` path intact.
- `ai:claude-cost-summary` returns `{ totalInputTokens, totalOutputTokens, totalCostUsd, durationMs }` from persisted parser events.
- `result.is_error=true` events publish a real unified `ERROR` notification with source `ai-task`, the Claude `instanceId`, subtype, duration, cost, and token summary.
- The public preload bridge exposes `window.devhub.r8.ai.claudeCostSummary(instanceId)` and `window.devhub.r8.ai.onClaudeStreamEvent(listener)`.
- The shared shim source `shim/codex/codex-shim.cjs` and the generated Node fallback from `ShimRegistry` now inject `--output-format stream-json` and `--include-partial-messages` before the first child spawn when the wrapped tool is `claude`, the operator uses `-p` or `--print`, and the operator has not explicitly selected a different output format.
- Explicit non-stream formats such as `--output-format json` are preserved and do not receive `--include-partial-messages`, avoiding a misleading partial-message flag outside stream-json mode.
- The generated fallback computes `childArgs` before `spawn()` and passes those normalized arguments to the real child process.
- If a real Claude child still writes non-stream-json output after shim normalization, the generated and packaged shim paths emit a structured fallback frame with the original argv, normalized restart args, cwd, fallback reason, and `requiresUserConfirmation=true`.
- `R8RuntimeService` converts that frame into a persisted `pending-confirmation` restart record and a unified `WARN` notification delivered through toast/statusbar with a `Restart with stream-json` action.
- The restart action is the project authorization popup surface for this slice: no live child is spawned until the operator clicks the notification action or a caller explicitly invokes the typed confirm method.
- After confirmation, DevHub runs a real local child process with `--output-format stream-json` and `--include-partial-messages`, records pid/running/exited or failed state, terminates the original Claude pid when available, and feeds the restarted stdout/stderr back into the Claude NDJSON parser.
- The packaged Electron E2E slice feeds schema-valid Claude stream-json system, assistant tool_use, and result lines through the real main-process parser test hook, observes both `cli:event-stream` and `ai:claude-stream-event` through preload subscriptions, and verifies `ai:claude-cost-summary` from persisted parser events.

## No-Mock Boundary

- The parser consumes real stdout/stderr chunks passed into the runtime bridge.
- The cost summary is computed from persisted `cliEvents`; it does not fabricate missing Claude usage.
- The stream bridge sends only schema-valid Claude events parsed from the original line payload.
- Invalid JSON and schema-incomplete events remain visible as low-confidence parser errors instead of being silently treated as success.
- Only schema-valid Claude `result` events with `is_error=true` trigger ERROR notifications; malformed JSON and schema-incomplete events do not fabricate task failures.
- The shim injection tests execute a real child process with `process.execPath` as the wrapped binary and inspect the actual child argv. They do not call the real Claude API and do not simulate parser success.
- The post-output restart tests execute `process.execPath` as the restarted child, assert that no restart happens while the request is only `pending-confirmation`, then confirm and verify a real pid, real exit, and real parser cost summary from the child's stdout.

## Boundaries Not Claimed Complete

- Old-version fallback for Claude Code releases that do not accept `--output-format stream-json` is not implemented in this slice; those releases remain unsupported for the structured Claude stream integration.

## Compatibility Matrix

Evidence date: 2026-05-16.

| Version line | Evidence | stream-json status | DevHub behavior |
|---|---|---|---|
| `0.1.x` | `npm view @anthropic-ai/claude-code versions --json` returned no `0.1.x` versions; published npm versions start at `0.2.9`. | Not applicable from npm evidence. | Not supported as a tested target. |
| `0.2.9` | `npx --yes --package @anthropic-ai/claude-code@0.2.9 claude --help` showed `-p, --print` but no `--output-format`, `stream-json`, or `--include-partial-messages` match. | Unsupported for structured stream-json. | Do not claim structured parsing support. |
| `0.2.126` | `npm view @anthropic-ai/claude-code@0.2.126 version bin --json` confirmed the package and `claude` bin. The low-resource help probe produced no matching stream-json flag output. | Not verified as stream-json capable. | Treat as unsupported until a local help/version probe proves otherwise. |
| `0.3.x` | `npm view @anthropic-ai/claude-code versions --json` returned no `0.3.x` versions in the current registry snapshot. | Not applicable from npm evidence. | Not supported as a tested target. |
| `1.0.0` | `npm view @anthropic-ai/claude-code@1.0.0 version bin --json` confirmed the package and `claude` bin. The low-resource help probe produced no matching stream-json flag output. | Not verified as stream-json capable. | Treat as unsupported until a local help/version probe proves otherwise. |
| Local `2.1.111` | `claude --version` returned `2.1.111 (Claude Code)`. `claude --help` lists `--output-format` choices including `stream-json`, `--include-partial-messages`, and `-p, --print`. | Supported and locally verified. | Pre-spawn shim injection is enabled for `-p/--print` when no explicit output format is present. |
| Registry current | `npm view @anthropic-ai/claude-code dist-tags version --json` returned `latest=2.1.142`, `stable=2.1.132`, and `next=2.1.143`; `npm view @anthropic-ai/claude-code@2.1.143 version bin --json` reports a Windows `bin/claude.exe` bin path. | Not locally executed in this slice. | Requires a future local help probe before claiming support. |

External corroboration: Grok search on 2026-05-16 found Anthropic's public CLI reference at `https://code.claude.com/docs/en/cli-reference` and reported that current Claude Code documents `--output-format stream-json` and `--include-partial-messages` as print-mode stream options. The local CLI help output above remains the authoritative runtime evidence for this machine.

## Verification

Commands used for this slice:

```bash
pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/R8RuntimeService.test.ts -t "Claude|result.is_error" --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts -t "Claude stream-json|ClaudeParser|ai:claude-stream-event" --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --testNamePattern "persists spec-22 recording manifests" --maxWorkers=1
pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts --maxWorkers=1
pnpm -C devhub shim:verify:codex
pnpm -C devhub test:e2e --grep "R8.C spec-03" --reporter=line
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "requires operator confirmation before restarting Claude" --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts -t "Claude|stream-json|ShimRegistry" --maxWorkers=1
pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub exec eslint src/shared/schemas/claude-stream.ts src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/services/shim/ShimRegistry.ts src/main/services/shim/ShimRegistry.test.ts shim/codex/codex-shim.cjs
pnpm -C devhub exec tsc --noEmit --pretty false
npm view @anthropic-ai/claude-code version versions --json
npm view @anthropic-ai/claude-code dist-tags version --json
npm view @anthropic-ai/claude-code@0.2.9 version bin --json
npm view @anthropic-ai/claude-code@0.2.126 version bin --json
npm view @anthropic-ai/claude-code@1.0.0 version bin --json
npm view @anthropic-ai/claude-code@2.1.111 version bin --json
npm view @anthropic-ai/claude-code@2.1.143 version bin --json
npx --yes --package @anthropic-ai/claude-code@0.2.9 claude --help
claude --version
claude --help
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results:

- 2026-05-15 focused Claude result-error notification suite: 2 files passed, 7 tests passed, 96 skipped by filter.
- 2026-05-15 schema version field suite: 3 files passed, 7 tests passed, 120 skipped by filter.
- 2026-05-16 generated fallback and packaged-source shim injection suite: 1 file passed, 7 tests passed. The suite proves pre-spawn child argv normalization for `-p`, `--print`, existing `--output-format=stream-json`, explicit `--output-format json`, and non-print invocations without invoking the real Claude API.
- 2026-05-16 packaged Codex shim verification still passed after the shared shim source change: Windows x64 executable exited `0`, preserved stdout/stderr, and forwarded three named-pipe frames.
- 2026-05-16 packaged Electron Playwright E2E for `R8.C spec-03`: 1 test passed. The test feeds real NDJSON lines into the runtime parser hook, receives schemaVersion `1` system/assistant/result events through `ai:claude-stream-event`, observes `phase_marker`, `tool_invocation`, and `completion` through `cli:event-stream`, and verifies cost summary `{ input=10, output=2, cost=0.001, durationMs=1200 }`.
- 2026-05-16 compatibility evidence: npm registry snapshot shows no `0.1.x` or `0.3.x` releases, representative metadata for `0.2.9`, `0.2.126`, `1.0.0`, local `2.1.111`, and `2.1.143`, current dist-tags `latest=2.1.142`, `stable=2.1.132`, `next=2.1.143`, and local `claude --help` support for `--output-format stream-json`, `--include-partial-messages`, and `-p, --print`. The `0.2.9` help probe showed print mode but no stream-json flags.
- 2026-05-17 post-output restart authorization closure: focused restart test passed with one selected `R8RuntimeService` case, proving pending-confirmation before restart, real local child pid after confirmation, exited status, and cost summary from the restarted child's stream-json stdout.
- 2026-05-17 Claude grouped regression: 3 files passed, 16 tests passed, 113 skipped by filter across `ClaudeParser.test.ts`, `ShimRegistry.test.ts`, and `R8RuntimeService.test.ts`.
- 2026-05-17 schema/preload regression: 2 files passed, 26 tests passed.
- 2026-05-17 touched-file ESLint and full `tsc --noEmit --pretty false`: passed.
- Targeted Claude/runtime/preload suite: 5 files passed, 103 tests passed on the first run.
- One later grouped rerun surfaced an unrelated `spec-22` recording manifest race; the exact failing test passed when rerun by `--testNamePattern`.
- TypeScript typecheck: passed.
- Lint and no-emoji gate: passed; `No emoji found in 574 files`.
- Zod SoT verification: passed.
