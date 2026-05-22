# R8.B Drawer System

## Scope

This document records the verified R8.B spec-03 implementation for the five-slot drawer system. The implementation provides the real renderer host, state model, executable IPC persistence, layout save/load, Drawer to popout morphing, BrowserWindow popout return-to-Drawer, and benchmark evidence without replacing the existing three-pane monitor IA.

## Implemented Runtime Path

- Renderer entry: `src/renderer/components/drawer/DrawerSystemHost.tsx`.
- Provider and command event bridge: `src/renderer/components/drawer/DrawerProvider.tsx`.
- Slot model and registry: `src/renderer/components/drawer/drawer-model.ts`.
- Lazy content modules: `src/renderer/components/drawer/DrawerContentRegistry.tsx` and `src/renderer/components/drawer/DrawerContentModules.tsx`.
- Store: `src/renderer/stores/drawerStore.ts`.
- Hook: `src/renderer/hooks/useDrawer.ts`.
- Main persistence: `src/main/services/R8RuntimeService.ts`.
- IPC registration: `src/main/ipc/r8RuntimeHandlers.ts`.
- Preload bridge: `src/preload/index.ts`.

## Five Slots

| Slot | Default Content | Default Size | Z-Index |
| --- | --- | ---: | ---: |
| `top` | `notifications.top` | `80px` height | `2000` |
| `right` | `monitor.port-detail` | `360px` width | `2010` |
| `bottom` | `observability` | `240px` height | `2020` |
| `floating` | `popout.manager` | `320px` width | `4000` |
| `statusbar` | `statusbar.aggregate` | `28px` height | `1500` |

The main content is padded by the open top, right, and bottom slots through `--drawer-top`, `--drawer-right`, `--drawer-bottom`, and `--motion-drawer`. This keeps the original three-pane IA intact when drawers are closed and lets open drawers compress the active content area instead of deleting existing panels.

## IPC Contract

The following channels are executable in the current build:

- `drawer:get-state`
- `drawer:set-state`
- `drawer:save-layout`
- `drawer:load-layout`
- `drawer:list-layouts`
- `drawer:morph-to-popout`
- `drawer:morph-from-popout`

State and layout records are validated through the R8 Zod schema registry. Size boundaries are clamped on both renderer model and main service paths before persistence.

## Command Palette Integration

The runtime command registry now includes:

- `drawer.notifications` opens the top notifications drawer.
- `drawer.observability` opens the bottom observability drawer.
- `drawer.statusbar` opens the statusbar aggregate drawer.

Commands are delivered to the renderer via the existing `r8:command-event` stream with `type = drawer-open`; `DrawerProvider` consumes that event and updates the persisted drawer state.

## Lazy Content Registry

`DrawerContentRegistry` resolves every registered content ID through `React.lazy` and `Suspense`. The current build lazy-loads real renderer adapters for notification records, status aggregate badges, and the BrowserWindow popout list from the existing `window.devhub.r8` bridge. Terminal/log content and downstream-only content IDs render a registered-boundary message instead of simulated content, so the UI stays truthful while later specs attach their dedicated renderers.

## Popout Return Path

The floating `popout.manager` drawer lists active BrowserWindow popouts from the real `window.devhub.r8.popout.list()` bridge. Each active popout exposes a `收回 Drawer` action that calls the existing `drawer:morph-from-popout` bridge through `useDrawerStore.morphFromPopout()`. The runtime closes the live secondary BrowserWindow, marks the popout closed in `electron-store`, and opens the target Drawer slot with the original `targetId` as content.

`devhub/e2e/example.spec.ts` verifies this against a real Electron BrowserWindow popout: it creates a live `browserwindow` popout, opens the floating manager drawer, clicks the return action, observes the popout window close, verifies `drawer-right` is visible, and checks persisted drawer/popout state through IPC.

## Benchmark

`pnpm -C devhub bench:drawer` builds a production Drawer bundle and runs a real Chromium click loop against the launcher and close controls.

The 2026-05-16 run produced:

- `passed: true`
- `iterations: 1000`
- `cycleStats.p99: 35.2ms`
- `persistCount: 2000`
- `persistStats.p95: 0.1ms`
- `p99BudgetMs: 250`
- `persistP95BudgetMs: 80`

## Current Completion Boundary

Implemented and validated:

- Five simultaneous renderer slots with launcher buttons and deterministic test IDs.
- Resize handles using pointer events with cleanup of global listeners.
- Header controls for pin, close, and Drawer to popout morph.
- Built-in registry for twelve content IDs.
- Lazy content resolver for all registered content IDs.
- Real notification, status aggregate, and popout-list content adapters where current IPC sources exist.
- Electron-store-backed state and layout persistence through `R8RuntimeService`.
- Real Electron restart persistence for the right Drawer slot.
- Real Electron BrowserWindow return-to-Drawer path through the floating Popout Manager drawer.
- Production Chromium benchmark for 1000 open/close cycles and 2000 `drawer:set-state` persistence calls.

Intentional ownership boundaries:

- Dedicated renderer implementations for downstream-only content IDs remain owned by their downstream specs. The Drawer registry renders truthful registered-boundary content instead of mock data until those specs attach dedicated renderers.
- Full downstream spec-04 and spec-08 completion remains tracked by their own ledger rows.
