# R8.B Statusbar Extension

This document records the implemented boundary for `prompts/0503-2/R8.B/spec-08-statusbar-extension.md`.

## Implemented Slice

- `status:aggregate` now returns the R8.B statusbar tile contract through the existing runtime IPC bridge.
- The renderer statusbar shows 12 built-in tile definitions through a shared slot renderer:
  - `cpu`
  - `mem`
  - `net`
  - `battery`
  - `projects`
  - `ai-tasks`
  - `public-ports`
  - `listening-ports`
  - `notifications`
  - `popouts`
  - `theme`
  - `cmdk`
- Battery is present in the contract but hidden when no local battery data is available.
- Badge rendering supports the six spec badge types: `new`, `unread`, `number`, `experimental`, `warning`, and `error`.
- Click actions route through existing real surfaces:
  - `open-drawer` uses the R8.B drawer store.
  - `navigate` dispatches monitor navigation events.
  - `invoke-cmd` calls the command palette IPC bridge.
  - `open-cmdk` dispatches `devhub:open-command-palette`, handled by `App.tsx`.
- The statusbar preserves the pre-existing topology redundant entrypoint.
- Overflow rendering is implemented and covered by unit tests.

## Data Sources

- CPU and memory use the scanner `systemSummary` values.
- Listening ports use the scanner port cache when available, then `systemSummary.activePortCount` as fallback.
- Public ports use scanner port endpoint data and treat wildcard bindings as public exposure.
- Running projects use the real app store project list.
- AI tasks use scanner AI task cache when available, then `systemSummary.aiToolCount` as fallback.
- Notifications use the local notification list.
- Popouts combine the real live runtime BrowserWindow popout list with a renderer-side floating port popout store, so the statusbar count reacts to local open/pin/close without pushing renderer-only UI state into the main process.
- Successful port BrowserWindow promotion removes the renderer floating card from that combined count, preventing the same popout from being counted twice during the handoff.
- Theme reads the persisted appearance theme from settings.
- Tile visibility, order, and alignment are now backed by executable `statusbar:get-config`, `statusbar:set-config`, and `statusbar:reset` IPC handlers.
- The config bridge is exposed through preload and renderer global typings, and the renderer applies persisted visibility/order/alignment without replacing the live tile values from the aggregate.
- The stored config is validated by the shared Zod `StatusbarConfig` schema and rejects duplicate tile ids.
- `StatusAggregator` runs in the main process with a one-second interval and publishes validated `status:aggregate` snapshots to the main window through `webContents.send`.
- The preload bridge exposes `status.onAggregate()` with listener cleanup; the renderer consumes push updates while keeping the existing query path as a fallback.
- SettingsDialog exposes statusbar tile visibility toggles and a reset control backed by the executable statusbar config bridge.
- SettingsDialog supports drag-and-drop tile ordering and persists the new order through the same executable config bridge.
- Saving SettingsDialog statusbar controls dispatches `devhub:statusbar-config-changed`, so a mounted statusbar applies the persisted visibility immediately.
- The built Electron app exposes a development/test-only runtime hook for the benchmark to drive the existing `StatusAggregator.publishNow()` path without adding a user-facing IPC channel.
- The rendered statusbar carries `data-r8b-statusbar-generated-at` so the benchmark can measure real `status:aggregate` receive-to-DOM-commit latency without inspecting React internals.
- `StatusBarProcessHistoryWidget` is an auxiliary widget outside the 12-tile aggregate contract. It links spec-08 statusbar placement to spec-14 process history by selecting the current highest-CPU process from the real process store, loading 24h history through `process:history-24h`, and rendering the existing `ProcessSparkline`.
- The auxiliary process-history widget dispatches Process monitor navigation with the selected process scope instead of introducing a second process-detail surface.

No mock data is introduced. Renderer fallback values are local zero-state projections for environments where the Electron bridge is unavailable, such as unit tests or static rendering.

## Security and Dependency Boundary

- No cloud dependency was added.
- No OCR dependency was added.
- No new icon source was added; the statusbar uses the existing installed SVG icon component library.
- Network and battery remain local placeholders until dedicated local collectors exist.

## Completion Boundary

- `prompts/0503-2/R8.B/spec-08-statusbar-extension.md` is verified for the current R8.B statusbar scope.
- Broader R8.B remains partial because other R8.B spec files still have open ledger items.

## Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/statusbar/statusbar-model.test.ts src/renderer/components/statusbar/StatusBar.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "statusbar|StatusBar|status aggregate|R8.B statusbar"
pnpm -C devhub test --run src/renderer/components/statusbar/statusbar-model.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "statusbar|status aggregate|IPC channels"
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/hooks/useStatusBarAggregate.ts src/renderer/components/statusbar/statusbar-model.ts src/renderer/components/statusbar/statusbar-model.test.ts src/main/services/R8RuntimeService.test.ts
pnpm -C devhub exec eslint src/main/services/StatusAggregator.ts src/main/services/R8RuntimeService.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/hooks/useStatusBarAggregate.ts src/main/services/R8RuntimeService.test.ts
pnpm -C devhub test --run src/renderer/components/settings/SettingsDialog.statusbar.test.tsx src/renderer/components/statusbar/StatusBar.test.tsx src/renderer/components/statusbar/statusbar-model.test.ts --maxWorkers=1 -t "statusbar|SettingsDialog|StatusBar"
pnpm -C devhub exec eslint src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx src/renderer/hooks/useStatusBarAggregate.ts src/renderer/components/statusbar/statusbar-model.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1 -t "preload whitelist"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub build
pnpm -C devhub bench:statusbar
pnpm -C devhub test --run src/renderer/components/statusbar/StatusBar.test.tsx --maxWorkers=1
pnpm -C devhub bench:sparkline
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-08" --workers=1 --reporter=line
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Results:

- Targeted statusbar regression passed: 3 files, 7 tests passed, 57 skipped by the name filter, `--maxWorkers=1`.
- Config-persistence regression passed: 3 files, 8 tests passed, 112 skipped by the name filter, `--maxWorkers=1`.
- Updated statusbar regression passed: 3 files, 11 tests passed, 92 skipped by the name filter, `--maxWorkers=1`.
- Touched-file ESLint passed for statusbar schema/runtime/IPC/preload/global/hook/model/test files.
- Touched-file ESLint passed for `StatusAggregator` push bridge files.
- SettingsDialog/statusbar combined regression passed: 3 files, 10 tests passed, `--maxWorkers=1`.
- Focused SettingsDialog drag-order regression passed: 1 file, 3 tests passed, `--maxWorkers=1`.
- Touched-file ESLint passed for SettingsDialog statusbar control files.
- `tsc --noEmit --pretty false` passed.
- Preload whitelist contract passed after adding statusbar config invoke channels and the `status:aggregate` listener channel to the contract.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed.
- Electron production build passed with the existing Monaco chunk warning only.
- 1000-push statusbar benchmark passed against the built Electron app: p50 1.6ms, p95 3ms, p99 4.5ms, max 15.1ms, 1000 samples, budget 100ms.
- Statusbar process-history widget regression passed: selected the real highest-CPU process-store row, called `getProcessHistory24h({ exe, cwd })`, rendered the mini `ProcessSparkline`, and dispatched Process monitor navigation.
- 100-sparkline DOM benchmark passed for the production `ProcessSparkline` bundle with 1440-point histories: p95 10.8ms under the 16ms budget.
- Real Electron Playwright `R8.B spec-08` passed: push listener observed 12+ tiles and 6+ badges, SettingsDialog drag-and-drop order persisted, CPU tile hiding updated live DOM, and the original persisted config was restored in `finally`.
- Zod SoT verification passed.
- No-cloud and no-OCR dependency guards passed.
