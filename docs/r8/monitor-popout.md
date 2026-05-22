# R8.C Monitor Tool Popout

Last updated: 2026-05-08

## Scope

This document records the current implementation truth for `prompts/0503-2/R8.C/spec-08-monitor-window-popout.md`.

The monitor tool popout is implemented through the same BrowserWindow popout bridge used by R8.B. It is not a separate Vite renderer entry yet, and it does not introduce a second privileged preload file.

## Runtime Flow

1. User clicks a monitor tool card popout button in `MonitorWindowCards`.
2. Renderer calls `window.devhub.r8.monitor.openPopout(tool, layout)`.
3. Preload invokes `monitor:popout-open`.
4. `R8RuntimeService.openMonitorPopout()` verifies:
   - `R8.C.monitor.popout` is enabled,
   - the main monitor BrowserWindow is live,
   - the same tool does not already have a live popout.
5. The existing R8.B popout bridge creates a `surface=monitor` BrowserWindow whose `target` query parameter is the tool name.
6. The renderer opens the monitor view and `R8OpsPanel` renders only the target tool card for tool popout windows.
7. Parser/title updates drive `monitor:popout-snapshot-stream`, carrying the real `ToolMonitorCard` payload for that tool.

## Limits

- Default bounds: 320x140.
- Minimum bounds: 200x100.
- Effective max count: 5 monitor tool popouts.
- Duplicate same-tool popouts fail with `E_VALIDATION`.
- Opening a tool popout without the main monitor window fails with `E_NOT_FOUND`.

## Preload Surface

The public monitor popout bridge is intentionally narrow:

- `window.devhub.r8.monitor.openPopout(tool, layout)`
- `window.devhub.r8.monitor.closePopout(popoutId)`
- `window.devhub.r8.monitor.listPopouts()`
- `window.devhub.r8.monitor.returnPopoutToMain(popoutId)`
- `window.devhub.r8.monitor.onPopoutSnapshotStream(callback)`

The bridge does not expose raw `ipcRenderer`. The whitelist source is `prompts/0421/contracts/23-ipc-contracts-master.md`.

## Stream Contract

- Channel: `monitor:popout-snapshot-stream`
- Payload: `ToolMonitorCard`
- Source: latest real `MonitorSnapshot`
- Target: live monitor tool BrowserWindow for the matching tool
- Synthetic state: none

## Renderer Behavior

- Main monitor cards expose a `弹出` action.
- Popped-out tools show `已弹出`.
- Tool popout BrowserWindows render only their target tool card.
- Double-clicking the single-tool card calls `monitor:popout-return-to-main`.

## Audit

Audit actions written through `AuditLogger`:

- `monitor:popout-open`
- `monitor:popout-close`

## Verification

Latest low-resource verification:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx --testNamePattern "monitor|Monitor|popout|Popout|preload|snapshot|confidence" --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
```

Results from 2026-05-08:

- targeted monitor/popout/preload tests passed: 4 files, 22 tests;
- typecheck passed;
- Zod SoT verification passed;
- lint passed, including no-emoji over 580 files.

## Known Open Items

- Dedicated monitor-popout renderer build entry is not implemented.
- Dedicated independent preload file is not implemented.
- Persisted right-click layout switching channel/UI is not implemented.
- Packaged Electron Playwright 5 GWT coverage is not implemented.
- Main-monitor-close survival still needs an explicit packaged proof.
