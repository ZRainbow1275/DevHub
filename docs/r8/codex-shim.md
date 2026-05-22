# R8.C Codex SHIM

Date: 2026-05-16

## Purpose

The Codex SHIM gives DevHub a real, opt-in way to observe Codex CLI stdout and stderr while preserving the operator's normal terminal experience. It does not fabricate task progress. It only forwards real lines emitted by the wrapped CLI process and converts strict DevHub marker lines into parser events.

## Current Implementation

- `shim/codex/codex-shim.cjs` is packaged by `@yao-pkg/pkg` into real Codex shim executables under `resources/shims/codex/`.
- `scripts/build-codex-shim.mjs` builds Windows x64, Linux x64, and macOS x64 artifacts from the same source; `scripts/verify-codex-shim-package.mjs` executes the Windows artifact locally and verifies passthrough plus named-pipe forwarding.
- `src/main/services/shim/ShimRegistry.ts` prefers the packaged Codex executable when it exists and installs it as `codex.exe` on Windows under Electron `userData/r8-cli-shims`.
- The packaged executable reads a `${shimExePath}.json` sidecar manifest with the real CLI path, pipe name, and tool name, so external terminal launches do not depend on transient DevHub environment variables.
- If no packaged artifact is present, `ShimRegistry` still writes the older Node passthrough shim script as a development fallback.
- Installation requires explicit `confirmedBy`; unauthenticated install and uninstall calls fail with `E_PERMISSION`.
- The shim directory is prepended only to the current DevHub process `PATH`. The implementation does not modify `HKCU\Environment`, shell profiles, or machine-wide environment variables.
- The shim pipes `stdin`, mirrors `stdout` and `stderr` to the user terminal, forwards framed lines to the DevHub pipe when connected, and exits with the wrapped process result.
- The packaged shim preserves the same behavior: `stdout`, `stderr`, child exit code, and named-pipe frames are verified by the local package verification script.
- `src/main/services/shim/MarkerProtocol.ts` accepts only `DEVHUB::MARKER::v=1::*` marker lines with a known field and rejects marker-looking spoof lines as ordinary stdout.
- `src/main/services/cli-parser/parsers/CodexParser.ts` maps the seven marker fields `PHASE`, `PROGRESS`, `TOKENS`, `TOOL`, `ERROR`, `DONE`, and `HEARTBEAT` into normalized `CliOutputEvent` records.
- Startup reconciliation keeps healthy manifests, removes missing shim files, removes missing sidecar manifests for packaged shims, and removes dead manifests whose real CLI path is no longer available.
- Shim clients reconnect to the DevHub named pipe with bounded backoff from 100ms to 1000ms without changing user-visible terminal output.

## Operator Behavior

After installing the shim, DevHub-launched child processes inherit a `PATH` where the shim directory comes before the real CLI location. Existing external terminals may still need to be restarted or configured manually because this slice deliberately avoids changing global user environment variables.

## Packaged Artifact Matrix

| Target | Artifact | Local verification |
|---|---|---|
| Windows x64 | `resources/shims/codex/codex-shim-win32-x64.exe` | Built and executed on this machine. |
| Linux x64 | `resources/shims/codex/codex-shim-linux-x64` | Built by cross-target package command; execution is not run on Windows. |
| macOS x64 | `resources/shims/codex/codex-shim-darwin-x64` | Built by cross-target package command; execution is not run on Windows. |

Generated binaries and `.sha256` files are intentionally ignored by git; the reproducible source, config, build script, and verification script are tracked.

## Boundaries Not Claimed Complete

- This document verifies Codex packaged shim executable closure for the current R8.C spec-02 scope. It does not claim Claude/Gemini packaged executable closure.
- macOS and Linux artifacts are built on Windows through `@yao-pkg/pkg`; execution proof is Windows-only in this local validation pass.

## Verification

Commands used for this slice:

```bash
pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts src/main/services/cli-parser/parsers/CodexParser.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/parsers/CodexParser.test.ts --maxWorkers=1
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

- SHIM/Codex targeted suite: 3 files passed, 17 tests passed.
- Codex marker field suite: 1 file passed, 9 tests passed.
- Packaged Codex shim build: Windows x64, Linux x64, and macOS x64 artifacts generated with SHA256 sidecars.
- Packaged Codex shim verify: Windows x64 executable exited `0`, preserved stdout/stderr, and forwarded three named-pipe frames.
- Shim runtime targeted suite: 2 files passed, 6 shim-focused tests passed.
- Full related Vitest suite: 3 files passed, 116 tests passed.
- Packaged Electron E2E: 1 spec-02 test passed.
- Production build: passed.
- TypeScript typecheck: passed.
- Lint and no-emoji gate: passed.
- Zod SoT verification: passed.
- No-cloud dependency guard: passed.
- No-OCR dependency guard: passed.
