# R8.C Cursor/Copilot Window-Title Detection

This document records the current executable boundary for `prompts/0503-2/R8.C/spec-05-cursor-copilot-detection.md`.

## Implemented

- `src/shared/schemas/window-title-pattern.ts` is the shared Zod source of truth for title rules, samples, signals, status responses, and rule reload requests.
- `src/main/services/cli-parser/title-rules.json` stores built-in Cursor and Copilot title patterns used by the parser defaults.
- `CursorTitleParser` and `CopilotTitleParser` parse real title strings into `CliOutputEvent` values with `rawSource='window-title'`.
- `CursorCopilotDetector` consumes real scanner window snapshots, hashes titles with SHA-256 truncated to 16 hex characters, and returns parsed status without process injection.
- Process validation is an executable-basename allowlist: `cursor.exe` for Cursor, and `code.exe` / `gh.exe` for Copilot paths.
- Detector sampling is capped at 5 Hz and unchanged signals from the same `hwnd` are reused for 5 seconds.
- Confidence from window-title signals remains bounded to `0.7`.
- `cli:title-rule-reload` applies confirmed user override rules through both the detector and `CLIOutputParser`.
- `cli:cursor-copilot-status` and `cli:title-rule-reload` are exposed through IPC and preload; the status bridge accepts an optional `instanceId`.
- `R8RuntimeService.cursorCopilotStatus()` writes `cli:cursor-copilot-title-signal` audit rows with `titleHash` and window/process metadata only.
- `R8.C.cli.cursor-copilot` defaults on for `win32` and off for `darwin` / `linux` in shared feature flag evaluation.
- `Win32WindowEnumerator` loads the installed `koffi` native module on Windows and calls real `user32.dll` `EnumWindows`, `GetWindowTextW`, `GetClassNameW`, `GetWindowRect`, `GetWindowThreadProcessId`, `IsWindowVisible`, and `IsIconic`.
- `WindowManager.scanWindows(false)` is native-first on Windows and keeps the existing PowerShell C# enumerator as a fallback if `koffi` or a Win32 binding is unavailable.

## Privacy Boundary

- The detector does not read IDE window contents and does not inject into Cursor, VS Code, or GitHub CLI processes.
- `titleHash` is the audit-friendly correlation field and is required to be a 16-character lowercase hex string.
- Privacy audit rows include `titleHash`, `hwnd`, `pid`, `processName`, `phase`, `confidence`, and `source`; they do not include `rawTitle`.
- `rawTitle` remains available only on explicit status/debug responses because the UI needs transparent local diagnosis for this R8 slice.

## Not Claimed Complete

- Persistent user `title-rules.json` filesystem watching is not implemented.
- Renderer settings for editing title rules are not implemented.
- Packaged Electron Playwright E2E coverage is not implemented.
- SignalCollector fusion wiring remains downstream R8.C spec-27 work.

## Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/main/services/cli-parser/CursorCopilotDetector.test.ts src/shared/schemas/r8-runtime.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts --testNamePattern "cursor|copilot|title|preload|specific" --maxWorkers=1
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts --testNamePattern "Cursor|Copilot|cursor|copilot|title" --maxWorkers=1
pnpm -C devhub test --run src/main/services/cli-parser/CursorCopilotDetector.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "Cursor|Copilot|cursor|copilot|title"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
pnpm -C devhub test --run src/main/services/WindowManager.test.ts -t "EnumWindows|GetWindowTextW|Koffi" --maxWorkers=1
pnpm -C devhub test --run src/main/services/WindowManager.test.ts --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/integrations/Win32WindowEnumerator.ts src/main/services/integrations/index.ts src/main/services/WindowManager.ts src/main/services/WindowManager.test.ts
pnpm -C devhub exec tsc --noEmit --pretty false
node devhub/scripts/smoke-koffi-window-enumerator.mjs
node --check devhub/scripts/smoke-koffi-window-enumerator.mjs
```

Results:

- Detector, shared schema, and feature-flag tests passed: 3 files, 26 tests.
- IPC and preload targeted tests passed: 2 files, 5 selected tests.
- Runtime title-path tests passed: 1 file passed, 1 skipped by name filter, 2 selected tests.
- Privacy audit regression passed: 3 files, 11 selected tests; runtime audit assertion verifies `rawTitle` is not written.
- TypeScript typecheck passed.
- Zod source-of-truth verification passed.
- ESLint and no-emoji guard passed.
- Direct Koffi Win32 smoke passed against real `user32.dll`: `ok=true`, `visibleTitleCount=13`, and real hwnd/pid/titleLength samples were returned.
- `WindowManager.test.ts` passed 10/10 tests, including native-first snapshots and PowerShell fallback preservation.
