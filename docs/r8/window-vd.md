# R8.B Window Virtual Desktop and Monitor Tracking

This document records the implemented boundary for `prompts/0503-2/R8.B/spec-11-window-virtual-desktop.md`.

## Implemented Slice

- Shared Zod contracts now exist in `src/shared/schemas/r8-runtime.ts`:
  - `virtualDesktopSchema`
  - `r8MonitorInfoSchema`
  - `windowVdInfoSchema`
  - `windowLayoutPresetSchema`
  - executable request/response contracts for VD info, desktop move, monitor move, monitor list, VD watch payloads, and layout preset save/list/apply
- The derived TypeScript types remain `z.infer` outputs:
  - `VirtualDesktop`
  - `R8MonitorInfo`
  - `WindowVdInfo`
  - `WindowLayoutPreset`
- `VirtualDesktopService` calls the real Windows `IVirtualDesktopManager` COM interface through the existing bounded `PowerShellGateway`:
  - `IsWindowOnCurrentVirtualDesktop`
  - `GetWindowDesktopId`
  - `MoveWindowToDesktop`
  - registry-backed `VirtualDesktopIDs` reading when available
- `VirtualDesktopService.queryWindows()` reuses fresh real per-HWND COM results for 2 seconds, and `listDesktops()` reuses fresh real desktop-list rows for 2 seconds. Cache entries are evicted when stale, and `MoveWindowToDesktop` invalidates the moved HWND/list rows before retry/refresh. The cache stores only real query results; it does not invent desktop IDs or success states.
- `MonitorService` wraps Electron `screen.getAllDisplays()` and `screen.getPrimaryDisplay()` into the R8 monitor contract.
- `MonitorService.watch()` subscribes to real Electron `display-added`, `display-removed`, and `display-metrics-changed` events and detaches exact listener callbacks.
- BrowserWindow popout records now persist display affinity metadata (`displayId`, pending restore bounds/display id, migration timestamp). The existing `R8RuntimeService` popout screen watcher migrates off-screen BrowserWindow popouts to the primary display when Electron reports display removal or metric changes, then restores them to their previous bounds when the original display is present again.
- `WindowLayoutPresetStore` persists named layouts in `electron-store` and applies live matched windows through real `WindowManager.moveWindow()`.
- `window:vd-list`, `window:vd-info`, `window:vd-watch`, `window:move-to-desktop`, `window:monitors`, `window:move-to-monitor`, `window:layout-save`, `window:layout-list`, and `window:layout-apply` are executable IPC channels with preload/global typings.
- `window:vd-watch` is a main-to-renderer stream backed by real Electron display events. Each payload includes the event type, current real monitor list, current real virtual-desktop list or explicit unavailable reason, and an `emittedAt` timestamp.
- `Win32ForegroundEventWatcher` adds opt-in `SetWinEventHook(EVENT_SYSTEM_FOREGROUND)` plumbing for foreground-change observation behind `DEVHUB_R8_VD_FOREGROUND_WATCH=1`. It remains disabled by default because the default path has verified latency requirements and the hook has not yet been validated as a true Windows virtual-desktop switch event stream.
- `WindowBatchExecutor` accepts the `move-to-desktop` action through a real adapter supplied by `setupWindowHandlers()`.
- `ThumbnailTile` renders `VdMonitorBadge` over thumbnail wall metadata, and `ThumbnailService` now injects real non-null `desktopId` values into entries when COM returns them.
- `VdMonitorBadge` displays:
  - a real desktop GUID when the service has supplied one,
  - the current desktop boundary as `VD current` when COM does not supply a desktop ID,
  - monitor number derived from the existing thumbnail wall `monitorId`,
  - data attributes for E2E selectors.
- `VdSwitcher` exposes a real move-to-desktop affordance over the system-reported desktop list and shows unavailable state when Windows does not expose desktop IDs.
- The `spec-09` wall already supports `groupBy=desktop`; windows with `desktopId: null` still group under the current desktop rather than inventing fake desktop IDs.

## Truth Boundary

Windows virtual desktop COM integration is now implemented for query and move requests, but Windows may still reject `MoveWindowToDesktop` for specific HWND/desktop combinations. DevHub surfaces the HRESULT/error instead of converting it into success.

The current implementation deliberately avoids fabricating `desktopId` values. When COM, registry, access checks, or platform support are unavailable, thumbnail entries keep:

- `desktopId: null`
- `isOnCurrentDesktop: true` in the badge projection
- `VD current` as the user-visible label

Monitor labels are derived from real Electron display metadata where available. `move-to-monitor` preserves the target window size within the target monitor work area and calls the existing real `WindowManager.moveWindow()` path.

BrowserWindow popout multi-monitor migration is implemented in the production `R8RuntimeService` path used by spec-02 popouts. Unit coverage drives the same public service method with real persisted popout records and Electron display lists; it does not claim that this session physically unplugged and replugged a monitor.

Repeated `window:vd-info` queries now meet the original 50 ms p95 budget after the real-result cache path. The cold first COM bridge sample remains visible in benchmark output and is not hidden or converted into a fake fast result.

## Not Claimed Complete

- `window:vd-watch` is display/monitor-event backed; it is not claimed as a true system-level Windows virtual desktop switch event stream.
- `Win32ForegroundEventWatcher` is available only as an opt-in validation path and is not enabled in the default runtime.
- Live physical monitor disconnect/reconnect hardware verification is not claimed in this session.
- `check:r8-external-blockers` is expected to fail until the machine has a real second display, more than one Windows virtual desktop registry ID where required, and the relevant opt-in foreground hook validation environment.

## Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/utils/windowGroupKey.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub exec vitest run src/main/services/VirtualDesktopService.test.ts src/main/services/MonitorService.test.ts src/main/services/WindowLayoutPresetStore.test.ts src/main/services/ThumbnailService.test.ts src/main/services/WindowBatchExecutor.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "VirtualDesktopService|MonitorService|WindowLayoutPresetStore|ThumbnailService|WindowBatchExecutor|registers a handler for every R8 IPC contract channel"
pnpm -C devhub typecheck
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.B spec-11" --reporter=line
pnpm -C devhub bench:vd-info
pnpm -C devhub check:zod-sot
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/windowHandlers.ts src/main/services/MonitorService.ts src/main/services/MonitorService.test.ts src/preload/extended.ts src/renderer/types/global.d.ts --max-warnings=0
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/MonitorService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "virtual desktop watch|MonitorService|preload whitelist|R8 runtime contracts"
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts --max-warnings=0
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "BrowserWindow popout multi-display|restores migrated BrowserWindow|migrates off-screen BrowserWindow|R8 runtime contracts"
pnpm -C devhub exec vitest run src/main/services/VirtualDesktopService.test.ts --maxWorkers=1 --reporter=verbose
pnpm -C devhub exec vitest run src/main/services/VirtualDesktopService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 --reporter=dot
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "virtual desktop watch|registers a handler for every R8 IPC contract channel" --reporter=dot
pnpm -C devhub exec eslint src/main/ipc/windowHandlers.ts src/main/services/integrations/Win32ForegroundEventWatcher.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts --max-warnings=0
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:zod-sot
pnpm -C devhub build
VD_INFO_SAMPLES=20 VD_INFO_P95_BUDGET_MS=50 pnpm -C devhub bench:vd-info
pnpm -C devhub check:r8-external-blockers
```

Results:

- Targeted thumbnail wall desktop grouping and VD/monitor badge regression passed: 2 files, 8 tests passed, `--maxWorkers=1`.
- Virtual desktop, monitor, layout preset, thumbnail desktopId injection, batch move-to-desktop, and IPC registration unit coverage passed: 6 files, 25 tests passed, 24 skipped by filter.
- TypeScript typecheck passed.
- Production build passed; the existing Monaco dynamic/static import warning remains unrelated.
- Electron Playwright `R8.B spec-11` passed with a real external WinForms HWND, real `window:vd-info`, real thumbnail `desktopId` propagation, real `window:move-to-monitor`, and truthful `window:move-to-desktop` response handling.
- Historical pre-cache `bench:vd-info` evidence passed with two real external WinForms windows, three samples, totalResolved=6, and p95=1624.3ms under a conservative 2000ms PowerShell COM budget. The later 20-sample cached run supersedes this for repeated-query latency.
- Zod SoT verification passed.
- Targeted ESLint for the VD watch touched files passed with `--max-warnings=0`.
- VD watch schema, typed MonitorService watch callbacks, and preload whitelist contract coverage passed: 3 files, 31 tests.
- BrowserWindow popout multi-display restore metadata schema and R8RuntimeService disconnect/reconnect reflow coverage passed: 2 files, 27 tests passed, 132 skipped by filter.
- `VirtualDesktopService.test.ts` passed: 8 tests.
- Focused VD IPC/schema registration coverage passed: 31 tests in the combined `VirtualDesktopService` and `r8RuntimeHandlers` run; focused watch/handler filter passed with 2 selected tests.
- TypeScript no-emit, Zod SoT, production build, and touched-file ESLint passed after the cache and foreground-hook changes.
- `VD_INFO_SAMPLES=20 VD_INFO_P95_BUDGET_MS=50 pnpm -C devhub bench:vd-info` passed against two real external WinForms windows with `totalResolved=40`, `p50=3.2ms`, `p95=6.3ms`, `p99=959.6ms`, and `max=959.6ms`.
- `pnpm -C devhub check:r8-external-blockers -- --write-report ../.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/r8-external-blockers-current.json` currently reports real external blockers instead of passing: one renderable Electron/BrowserWindow display (`\\.\DISPLAY5`), `browserWindowSecondDisplay.valid=false`, two registry virtual desktop IDs, `foregroundHookOptIn=true`, non-admin user, no installed `devhub-watchdog` Windows Service, zero-egress preflight blocked by admin=false, `zeroEgressCapture.valid=false`, `packageJsonLicense=AGPL-3.0-or-later`, `licenseFileExists=true`, `legalDecisionConfirmed=false`, `legalDecisionEvidenceExists=false`, and `legalDecisionEvidenceValid=false`. The second-display closure now uses `pnpm -C devhub check:browserwindow-second-display`, which still requires a real non-primary display and a `devhub-browserwindow-second-display-v1` report where the BrowserWindow matched that display. The physical monitor unplug/replug closure uses `pnpm -C devhub check:physical-monitor-hotplug`, which still requires a real two-display baseline plus observed removal and reconnection.
