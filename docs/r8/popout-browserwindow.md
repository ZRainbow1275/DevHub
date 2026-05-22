# R8.B BrowserWindow Popout

## Current Implementation

BrowserWindow popouts are implemented through the R8 runtime service and IPC bridge:

- `src/shared/schemas/r8-runtime.ts`
- `src/main/services/R8RuntimeService.ts`
- `src/main/ipc/r8RuntimeHandlers.ts`
- `src/preload/index.ts`
- `src/preload/port-popout.ts`
- `src/renderer/port-popout.html`
- `src/renderer/port-popout.tsx`
- `src/renderer/types/global.d.ts`
- `electron.vite.config.ts`

The implementation uses Electron `BrowserWindow` with:

- `sandbox: true`
- `contextIsolation: true`
- `nodeIntegration: false`
- `webSecurity: true`
- external navigation denied through `setWindowOpenHandler`
- non-app navigation blocked through `will-navigate`

## IPC Surface

The executable lifecycle surface is:

- `popout:create`
- `popout:close`
- `popout:list`
- `popout:bridge-message`
- `popout:pin`
- `popout:save-bounds`
- `popout:move-to-monitor`
- `popout:promote-from-floating`
- `popout:demote`
- `popout:screen-event`

The preload bridge exposes the same lifecycle through `window.devhub.r8.popout`.
The renderer can also subscribe to bridge broadcasts with `window.devhub.r8.popout.onBridgeMessage()`.

## Runtime Behavior

- BrowserWindow mode creates a real independent Electron window.
- The runtime keeps a persisted popout record list in `electron-store`.
- The port BrowserWindow surface has a dedicated `port-popout` renderer and preload entry. `R8RuntimeService` loads `port-popout.html` in development and `../renderer/port-popout.html` in production so the popout shell stays isolated without duplicating the main app bundle.
- The dedicated port popout renderer is a lightweight shell instead of the full main app. It keeps the real `r8Popout` query binding, bridge heartbeat, pin, close, demote, screen-event, and theme-sync paths while avoiding the main `App`, dashboard, Monaco, and provider graph. The matching `port-popout` preload exposes only the required `window.devhub.r8.popout` surface.
- BrowserWindow popouts share the `persist:popouts` Electron session through `session.fromPartition('persist:popouts')` to avoid isolated session duplication across each popout window.
- When `DEVHUB_R8_POPOUT_PROCESS_REUSE=1` is set before `app.whenReady()`, the main process appends Chromium `process-per-site` so same-site port BrowserWindow popouts share a renderer process. The RSS benchmark enables this real runtime mode and reports both raw process RSS and effective per-window RSS for shared PIDs.
- The shared `persist:popouts` session installs a popout-specific Content-Security-Policy through `webRequest.onHeadersReceived`. Production popouts use `script-src 'self'`, explicit `worker-src 'self' blob:`, and deny `object-src`, `frame-src`, `base-uri` drift, and form submission. Development keeps the same deny rules while allowing only Vite-local HTTP/WebSocket and `unsafe-eval` for the dev server.
- Pinning updates `BrowserWindow.setAlwaysOnTop` and persists the pinned flag.
- Bounds saving clamps minimum size to `280x200`, persists the bounds, and updates a live window when present.
- Monitor migration uses Electron `screen.getAllDisplays()` and moves the popout to the selected display work area.
- Promotion closes an existing floating record when present and creates a BrowserWindow record.
- Demotion closes the BrowserWindow record and creates a floating record.
- Port-specific demotion uses `port:popout-demote` as a validated wrapper around the same `R8RuntimeService.demotePopout()` path, preserving the `port:<port>:pid:<pid>` identity while returning a typed floating port runtime record.
- A live BrowserWindow cap of eight is enforced with `E_RATE_LIMITED`.
- Renderer popout windows read the real `r8Popout` query parameter and send `popout:bridge-message` heartbeat payloads every five seconds through the preload bridge.
- The runtime stores `lastHeartbeatAt`, marks stale BrowserWindow bridges closed after the 30 second timeout, and excludes closed stale records from the live cap before creating more BrowserWindow popouts.
- Startup calls `restorePinnedPopouts()` after R8 runtime handler registration. Pinned BrowserWindow records that are persisted, not closed, and not already live are recreated with their saved route, bounds, title, and always-on-top state.
- `R8RuntimeService` attaches a main-window close policy. Closing the main window marks unpinned BrowserWindow popouts closed and closes their native windows, while pinned BrowserWindow popouts remain live and are forced always-on-top.
- Display change events trigger BrowserWindow popout reflow. Popout records persist their display affinity and pending restore bounds; bounds whose center point is no longer inside any active display work area are migrated to the primary display, then restored to their original bounds when that display is present again. Each `migrate-to-primary` or `restore` action broadcasts a `popout:screen-event` payload to the main window and live popouts.
- Non-pinned BrowserWindow popouts auto-close after 60 minutes without recorded interaction. Pinning, bounds updates, and user bridge actions refresh `lastInteractedAt`; heartbeat alone does not count as interaction.
- BrowserWindow RSS pressure handling samples real Electron process metrics. A single over-100MB BrowserWindow is minimized and recorded as degraded instead of immediately closed while total RSS is still safe. When total BrowserWindow RSS exceeds 500MB, fresh windows are degraded during the grace window, eligible unpinned windows are closed after the grace window, and pinned windows are degraded but not evicted.
- In development mode, closing a BrowserWindow popout schedules a 5-second RSS release assertion. The check records the closing renderer process id, samples real `app.getAppMetrics()` data, distinguishes released/recovered/shared-process/retained/unknown outcomes, and writes the result to the local audit log as `popout:rss-release-check`.
- Theme inheritance uses the existing PopoutBridge. When persisted settings change, the main process sends a `popout:bridge-message` sync payload with key `theme-settings` to every live BrowserWindow popout. The payload is validated by `PopoutThemeSyncPayload`, and `useTheme()` applies the synced palette, density, radius, motion, and decoration values in the popout renderer.

## Verification

Validated on 2026-05-05:

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Additional targeted coverage added after the initial slice:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
pnpm -C devhub test --run src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "popout|Popout|Bridge|Screen|schema|preload"
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/hooks/useTheme.test.tsx --maxWorkers=1 -t "popout|Popout|Bridge|theme|Theme|schema|preload"
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "popout|Popout|CSP|session"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub lint
```

2026-05-11 results: service/IPC popout regression passed with 2 files and 11 matching tests; preload/schema regression passed with 2 files and 12 matching tests; theme bridge regression passed with 4 files and 24 matching tests; popout CSP/session regression passed with 1 file and 17 matching tests; typecheck, Zod SoT, lint, and no-emoji gates passed.

2026-05-17 port-specific demote interop validation:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "demotes port-specific BrowserWindow popouts"
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "port-specific|BrowserWindow popout lifecycle|preload whitelist"
```

Results: the focused demote service regression passed; the combined IPC/service/preload whitelist regression passed with 7 tests across 3 files and verified the executable `port:popout-demote` bridge.

2026-05-17 RSS release assertion validation:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "checks BrowserWindow popout RSS release after close in dev assertion mode"
```

Result: the focused service regression passed and verified the dev-only 5-second RSS release assertion path against real `app.getAppMetrics()` data.

2026-05-17 dedicated port popout entry validation:

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "popout|Popout|BrowserWindow"
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
```

Results: the unit bundle passed with 4 files and 186 tests (124 skipped); the Playwright Electron `R8.B spec-02` run passed with 1 real Electron test in 15.0s. This verified the dedicated `port-popout` renderer/preload entry and the real BrowserWindow lifecycle path for create/list/bounds/heartbeat/pin/close.

2026-05-19 RSS benchmark and lightweight shell validation:

```bash
pnpm -C devhub exec eslint src/main/index.ts src/main/services/R8RuntimeService.ts src/preload/port-popout.ts src/renderer/port-popout.tsx scripts/bench-popout-bw-rss.mjs --max-warnings=0
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
POPOUT_BW_RSS_WINDOWS=3 POPOUT_BW_RSS_REPORT_PATH="D:/Desktop/CREATOR ONE/.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/popout-bw-rss-3bw-2026-05-19.json" pnpm -C devhub bench:popout-bw-rss
POPOUT_BW_RSS_REPORT_PATH="D:/Desktop/CREATOR ONE/.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/popout-bw-rss-8bw-2026-05-19.json" pnpm -C devhub bench:popout-bw-rss
```

Results: the dedicated `port-popout` renderer bundle is `10.80 kB`; the Electron Playwright `R8.B spec-02` lifecycle run passed and now asserts the visible `port-popout-shell` plus real target port. The 3-BrowserWindow RSS benchmark passed with `firstThreeAppRssIncrementMb=106.68`, `totalUniquePopoutRssMb=96.29`, `uniqueProcessCount=1`, and `maxEffectivePerWindowRssMb=32.10`. The 8-BrowserWindow RSS benchmark passed with `appRssIncrementMb=141.90`, `totalUniquePopoutRssMb=108.49`, `uniqueProcessCount=1`, and `maxEffectivePerWindowRssMb=13.56`.

2026-05-19 main-window close survival validation:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "main-window close keeps pinned" --workers=1 --reporter=line
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
```

Results: the new packaged Electron Playwright regression creates one pinned and one unpinned real port BrowserWindow popout, closes the native main BrowserWindow, verifies the unpinned popout closes, and verifies the pinned popout remains visible, connected, and always-on-top. The focused test passed with 1 real Electron test in 5.6s; the full `R8.B spec-02` grep passed with 2 real Electron tests in 7.2s.

2026-05-19 drag-back/demote UI validation:

```bash
pnpm -C devhub exec eslint e2e/example.spec.ts --max-warnings=0
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "demotes back to a floating record" --workers=1 --reporter=line
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-02" --workers=1 --reporter=line
```

Results: the new packaged Electron Playwright regression creates a real port BrowserWindow popout, clicks the dedicated shell's `Return To Main` button, observes the BrowserWindow close, and verifies the original record is `closed` while a new same-target `floating` record exists. The focused test passed with 1 real Electron test in 10.4s; the full `R8.B spec-02` grep passed with 3 real Electron tests in 20.2s.

2026-05-19 popout display reconnect restore validation:

```bash
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts --max-warnings=0
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "BrowserWindow popout multi-display|restores migrated BrowserWindow|migrates off-screen BrowserWindow|R8 runtime contracts"
```

Results: schema coverage verifies persisted `displayId`, `pendingRestoreBounds`, `pendingRestoreDisplayId`, and `displayMigratedAt` metadata. Service coverage verifies a real BrowserWindow popout record migrates to primary on `display-removed`, retains original bounds/display restore metadata, restores to original bounds on `display-added`, and emits both screen-event actions. The focused run passed with 2 files, 27 tests, and 132 skipped by filter.

## Boundaries

This slice does not claim multi-display drag-back placement, second-display packaged assertion evidence, or live physical monitor hardware verification.
