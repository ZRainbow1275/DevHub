# R8.C CLI Detection

This document records the current executable boundary for `prompts/0503-2/R8.C/spec-06-cli-detect-init.md`.

## Implemented

- `src/shared/schemas/tool-detect.ts` is the shared Zod source of truth for tool names, detection results, detection state, detect requests, and override requests.
- `cli:detect-all` returns a `ToolDetectionState` with exactly five result rows: `codex`, `claude`, `gemini`, `cursor`, and `copilot`.
- `R8RuntimeService.detectTools()` uses `Promise.allSettled`, so one failed probe does not abort the full scan.
- `R8RuntimeService.detectTool()` keeps the five-minute cache TTL for non-force detection.
- Version probes remain bounded with `execFile(..., { timeout: 3000 })`.
- User overrides are stored in `electron-store` under `toolOverrides` after `confirmedBy` and `existsSync` validation.
- Cursor and Copilot can be detected from real scanner cache rows with `detectStrategy='module-list'`, without requiring a native CLI.
- `cli:detection-event` is emitted after full scans and is also scheduled once after R8 IPC handler initialization.
- `auditLogger` records `cli:detect-all` duration, scanned tool names, and found tool names.
- `ToolDetectPanel` is mounted under Settings -> Advanced and shows current detection status plus force rescan.
- `R8OpsPanel` consumes the new detection state shape while preserving its existing operations view.

## Not Claimed Complete

- The implementation has not migrated to `execa`, `which`, or `semver`; it continues to use the existing `execFile` command map.
- The settings panel does not yet include a path override editor; override remains available through IPC/preload.
- The draft Playwright E2E is not implemented.
- Packaged Electron verification is not included in this slice.

## Verification

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
- Zod source-of-truth verification passed.
