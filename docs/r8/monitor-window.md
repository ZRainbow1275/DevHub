# R8.C Monitor Window

Last updated: 2026-05-08

## Scope

This document records the current implementation truth for `prompts/0503-2/R8.C/spec-07-monitor-window.md`.

The monitor window is implemented as an incremental slice on top of the existing R8.B BrowserWindow popout bridge. It does not introduce a separate renderer build entry yet, and it does not fabricate progress when a tool has no real parser, session, event, or title-signal input.

## Runtime Flow

1. Renderer calls `window.devhub.r8.monitor.open()`.
2. Preload invokes `monitor:open`.
3. `R8RuntimeService.openMonitorWindow()` creates or reuses a `surface=monitor` BrowserWindow popout.
4. `R8RuntimeService.monitorSnapshot()` builds five cards from:
   - stored CLI parser events and sessions,
   - Cursor/Copilot window-title signals from the scanner cache,
   - persisted monitor window preferences.
5. Parser updates call `queueMonitorSnapshotStream()`.
6. `monitor:snapshot-stream` broadcasts a throttled `MonitorSnapshot` to the main renderer fallback and live monitor BrowserWindow popouts.

## Data Contract

The source of truth is `src/shared/schemas/r8-runtime.ts`.

- `monitorWindowStateSchema`: persisted `alwaysOnTop`, `opacity`, and bounds.
- `toolMonitorCardSchema`: per-tool active state, phase, progress, tokens, cost, and recent events.
- `monitorSnapshotSchema`: exactly five tool cards plus current window state and collection timestamp.

## Preload Surface

The public renderer bridge is intentionally narrow:

- `window.devhub.r8.monitor.open()`
- `window.devhub.r8.monitor.close()`
- `window.devhub.r8.monitor.snapshot()`
- `window.devhub.r8.monitor.setWindowPrefs(input)`
- `window.devhub.r8.monitor.focusInstance(tool, instanceId)`
- `window.devhub.r8.monitor.onSnapshotStream(callback)`

The bridge does not expose raw `ipcRenderer`. Each channel is mirrored in `prompts/0421/contracts/23-ipc-contracts-master.md` and guarded by `src/preload/preloadContract.test.ts`.

## Stream Budget

- Channel: `monitor:snapshot-stream`
- Throttle: 100 ms in the main process
- Payload: full `MonitorSnapshot`
- Truth source: already-observed runtime state only
- No synthetic progress: inactive tools remain inactive
- No CLI detection side effects: `monitorSnapshot()` does not trigger `detectTools()`

## Renderer Surface

`src/renderer/components/monitor/MonitorWindowCards.tsx` renders exactly five cards from the snapshot:

- card click calls `monitor:focus-instance`,
- progress bar uses `progress.percent`,
- tokens and cost are displayed when real parser payloads provide them,
- confidence is shown through `ConfidenceBadge`.

`ConfidenceBadge` threshold classes:

- `<0.5`: error
- `0.5` to `<0.7`: warning
- `0.7` to `<0.9`: accent
- `>=0.9`: success

## Preferences And Audit

`alwaysOnTop` and `opacity` are changed from the R8 operations panel and persisted via `monitor:set-window-prefs` with `confirmedBy`.

Audit actions written through `AuditLogger`:

- `monitor:open`
- `monitor:set-window-prefs`
- `monitor:close`

## Verification

Latest low-resource verification:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx --testNamePattern "monitor|Monitor|preload|snapshot|confidence" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
```

Results from 2026-05-08:

- targeted monitor/preload tests passed: 4 files, 19 tests;
- typecheck passed;
- lint passed, including no-emoji over 580 files;
- Zod SoT verification passed.

## Known Open Items

- Dedicated `src/renderer/monitor` multi-entry build is not implemented.
- Packaged Electron Playwright 5 GWT coverage is not implemented.
- Main-window-close independent lifecycle still needs an explicit packaged proof.
- 4D theme synchronization still needs an explicit monitor-window test beyond token-class usage.
