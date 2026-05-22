# R8.B Port Popout

## Current Implementation

The R8.B port popout slice is implemented as a renderer-side floating card system for real `PortInfo` rows from `usePorts`.

Implemented files:

- `src/renderer/components/popout/port-popout-model.ts`
- `src/renderer/components/popout/usePortPopoutManager.ts`
- `src/renderer/components/popout/PortPopoutCard.tsx`
- `src/renderer/components/popout/PortPopoutTitleBar.tsx`
- `src/renderer/components/popout/PortPopoutHost.tsx`
- `src/renderer/components/popout/PortPopoutResizeHandles.tsx`
- `src/renderer/components/popout/PopoutTriggerLayer.tsx`
- `src/renderer/hooks/usePopoutTriggers.ts`
- `src/renderer/hooks/usePopoutManager.ts`
- `src/renderer/hooks/usePopoutSync.ts`
- `src/renderer/stores/portStore.ts`
- `src/renderer/stores/portPopoutStore.ts`
- `src/renderer/utils/popoutPositionMemory.ts`
- `src/renderer/utils/popoutZIndexAllocator.ts`
- `src/shared/schemas/r8-runtime.ts`
- `src/main/services/PopoutPositionStore.ts`
- `src/main/services/R8RuntimeService.ts`
- `src/main/ipc/r8RuntimeHandlers.ts`
- `src/preload/index.ts`
- `src/renderer/types/global.d.ts`
- `src/renderer/components/monitor/PortView.tsx`
- `src/shared/types-extended.ts`

## Trigger Contract

`PortView` card mode now exposes four real trigger paths:

- `hover`: opens after `1000ms` over a port card.
- `click`: opens from the explicit `Popout` card action.
- `drag`: opens when pointer movement reaches `8px`.
- `context-menu`: opens on the card context menu.

The explicit click action preserves the existing card click behavior. A normal card click still selects the port and opens the existing focus panel.
The hover, click, drag, context-menu, and long-press advanced-menu timers now flow through `PopoutTriggerLayer` plus `usePopoutTriggers`, so the four trigger paths share cleanup and settings handling instead of duplicating timer state in `PortView`.

## Runtime Behavior

- Floating popouts use the `4000..4999` z-index tier.
- At most five floating port cards can be open.
- Opening a sixth card evicts the oldest unpinned card.
- If all five cards are pinned, the sixth open request is blocked instead of deleting pinned context.
- Cards can be pinned, closed, and moved.
- Cards use an extracted `PortPopoutTitleBar` component for the real minimize, theme-isolate, pin, promote, and close actions, keeping titlebar behavior isolated from card content.
- The minimize action preserves the floating card/store entry and statusbar count while hiding the card body and resize handles until restored.
- The theme-isolate action toggles the real local sync policy to `theme=false` and `direction='isolated'`; restoring it reuses the current persisted/default sync policy without changing the other sync fields.
- Cards expose eight pointer-driven resize handles (`n/ne/e/se/s/sw/w/nw`), clamp to the R8 minimum size, and adjust the card origin correctly for north and west resizing.
- The host renders through `createPortal(..., document.body)` so floating cards escape the monitor view stacking context instead of being trapped inside the panel tree.
- Position and size memory is saved in local `localStorage` using stable `port:pid` keys, and the same geometry is mirrored into the main-process `electron-store` bridge through `port:popout-position-get` / `port:popout-position-save`. Existing position-only entries remain readable and fall back to the default card size.
- Open cards synchronize their displayed `PortInfo` from the latest scanner rows.
- The promote action calls the existing secure `window.devhub.r8.popout.create` BrowserWindow bridge with `surface: 'port'`.
- A successful BrowserWindow promote closes the renderer floating card immediately, so the popout manager and statusbar do not double-count the same port during handoff.
- The executable `port:popout-open`, `port:popout-close`, `port:popout-list`, `port:popout-pin`, `port:popout-batch`, `port:popout-sync`, and `port:popout-demote` channels now wrap the same real runtime state, preload bridge, and BrowserWindow popout lifecycle instead of remaining schema-only contracts.
- The port-specific demote path validates an active port BrowserWindow popout, reuses the existing spec-02 `demotePopout()` implementation, preserves the `port:<port>:pid:<pid>` identity, and returns the resulting floating port runtime record.
- The main process samples live BrowserWindow RSS. A single BrowserWindow port popout over 100MB is degraded by minimizing the native window instead of being closed immediately while the total budget is still safe. When total BrowserWindow RSS exceeds 500MB, the sweep closes eligible unpinned windows after the grace window and preserves pinned windows by degrading them instead of evicting them.
- In development mode, closing a BrowserWindow port popout schedules a 5-second RSS release assertion that samples real `app.getAppMetrics()` data and records `popout:rss-release-check` outcomes for released/recovered/shared-process/retained/unknown cases.
- Persisted `window.portPopout` settings now drive trigger behavior: hover, click, drag, and context-menu can be toggled independently, while hover delay and drag threshold are loaded from the real settings store.
- The monitor view listens for same-session `devhub:settings-change` updates, so saved trigger toggles and thresholds take effect without requiring a remount or app restart.
- The existing Window settings panel exposes these trigger toggles plus the delay and threshold controls; no mock state or renderer-only hardcoded override was introduced.
- The shared renderer `portStore` now owns the live popout list plus trigger timing bounds and named layout presets, and `portPopoutStore` remains a compatibility bridge for existing consumers and the statusbar count tile.
- Shared popout contracts are centralized in `src/shared/types-extended.ts`: trigger schema, sync-policy schema, position/size schema, z-index tier constants, popout limits, and `PortPopoutSchema`.
- `eslint.config.js` now includes a local `local/no-hardcoded-inline-z-index` rule that rejects numeric `zIndex` literals inside JSX inline `style` objects. Existing inline z-index usages in `ScriptSelector` and `ThemeDecoration` were migrated to the `--z-*` token family.
- BrowserWindow popout state sync now uses `usePopoutSync` plus the existing R8 popout bridge. The hook debounces outgoing `port-view-state` messages, validates incoming payloads with Zod, respects `both` / `main-to-popout` / `popout-to-main` / `isolated` direction policy, and syncs port selection, filter mode, search text, and view mode. Theme and density continue through the existing `useTheme` bridge-sync pipeline.

## Verification

Validated on 2026-05-05:

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Validated on 2026-05-10:

```bash
pnpm -C devhub test --run src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/store/AppStore.test.ts --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Validated on 2026-05-17:

```bash
pnpm -C devhub test --run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
```

Result: 2 files and 31 tests passed, including real renderer resize-handle interaction and same-port size restoration after close/reopen.

Validated on 2026-05-17 after the titlebar minimize/theme-isolate slice:

```bash
pnpm -C devhub exec vitest run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub exec eslint src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts
git -C devhub diff --check -- src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/popout/port-popout-model.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts docs/r8/port-popout.md
```

Result: 4 files and 41 tests passed across renderer/model/utility coverage; TypeScript, targeted ESLint, no-emoji, and diff whitespace checks passed. The regression coverage now proves titlebar minimize preserves the active popout count, titlebar theme isolation toggles/restores the real sync policy, position memory rejects corrupt payloads safely, and z-index allocation stays within the popout band.

Validated on 2026-05-17 after shared-contract and z-index lint hardening:

```bash
pnpm -C devhub exec vitest run src/shared/types-extended.test.ts src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub exec eslint src/shared/types-extended.ts src/shared/types-extended.test.ts src/renderer/components/popout/port-popout-model.ts src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts
pnpm -C devhub exec eslint src/renderer/components/ui/ScriptSelector.tsx src/renderer/components/ui/ThemeDecoration.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutTitleBar.tsx
git -C devhub diff --check -- src/shared/types-extended.ts src/shared/types-extended.test.ts src/renderer/components/popout/port-popout-model.ts src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts docs/r8/port-popout.md
```

Result: 5 files and 44 tests passed; TypeScript, no-emoji, targeted ESLint, the new inline z-index lint gate, and diff whitespace checks passed.

Validated on 2026-05-17 after the popout sync bridge slice:

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts -t "broadcasts generic popout sync" --maxWorkers=1
pnpm -C devhub exec vitest run src/shared/types-extended.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/shared/types-extended.ts src/shared/types-extended.test.ts src/renderer/hooks/usePopoutSync.ts src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/ui/ScriptSelector.tsx src/renderer/components/ui/ThemeDecoration.tsx src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx
pnpm -C devhub check:no-emoji
```

Result: targeted service sync broadcast passed, shared plus renderer popout tests passed with 32 tests, TypeScript passed, touched-file ESLint passed, and no-emoji passed. A broader `R8RuntimeService.test.ts` file run also exercised the new sync test successfully but still surfaced two unrelated pre-existing failures in CSV Python bridge and watchdog supervisor rows; those failures are not caused by this slice and remain outside this port-popout change.

Validated on 2026-05-17 after the port-specific IPC slice:

```bash
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "BrowserWindow popout lifecycle|port-specific popout|preload whitelist"
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/ipc/r8RuntimeHandlers.ts src/preload/index.ts src/renderer/types/global.d.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
git -C devhub diff --check
git diff --check
```

Result: targeted IPC/service/preload regression passed with 3 files and 6 tests; TypeScript, touched-file ESLint, Zod SoT, no-emoji, no-cloud, no-OCR, and diff whitespace gates passed. `git diff --check` emitted only the existing Windows LF-to-CRLF warnings and exited 0.

Validated on 2026-05-17 after the RSS degrade/evict slice:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "routes port-specific popout|degrades a single over-budget BrowserWindow port popout without closing it when the total budget is still safe|keeps a fresh over-total BrowserWindow port popout alive during the RSS degrade grace window|auto-evicts unpinned BrowserWindow port popouts when the RSS budget is exceeded"
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
git diff --check
```

Result: the targeted service regression passed; TypeScript, no-emoji, and diff whitespace gates passed. The RSS pressure path degrades a single over-budget BrowserWindow popout instead of closing it, keeps fresh over-total popouts alive during the grace window, and closes eligible unpinned windows only when total live RSS remains over budget.

Validated on 2026-05-17 after the port-specific demote interop slice:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "demotes port-specific BrowserWindow popouts"
pnpm -C devhub test --run src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts --maxWorkers=1 -t "port-specific|BrowserWindow popout lifecycle|preload whitelist"
```

Result: the focused service regression passed and the combined IPC/service/preload whitelist regression passed with 7 tests across 3 files. The new `port:popout-demote` path closes the original BrowserWindow record, creates a floating popout through the existing runtime demotion implementation, and keeps the port/PID identity intact.

Validated on 2026-05-17 after the RSS release assertion slice:

```bash
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "checks BrowserWindow popout RSS release after close in dev assertion mode"
```

Result: the focused service regression passed. The dev-only 5-second RSS release assertion path now records whether a BrowserWindow popout release actually drops or retains memory after close, without faking the metrics source.

Validated on 2026-05-17 after the main-process position store slice:

```bash
pnpm -C devhub exec vitest run src/main/services/PopoutPositionStore.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/PopoutPositionStore.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "port popout position|BrowserWindow popout lifecycle channels|validates port popout position persistence contracts|hydrates remembered popout geometry from the main popout position store bridge|resizes a floating port card and restores the same-port size on reopen"
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "covers every IPC channel declared|validates port popout position persistence contracts"
pnpm -C devhub exec vitest run src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub exec eslint src/main/services/PopoutPositionStore.ts src/main/services/PopoutPositionStore.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/components/monitor/PortView.port-popout.test.tsx src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts
git diff --check
```

Result: the `PopoutPositionStore` uses a real temporary `electron-store` instance in tests, `R8RuntimeService` persists and reloads geometry across service instances, preload whitelist stays synchronized, renderer hydration restores stored geometry from the main bridge, and resize saves geometry back through `port:popout-position-save`.

Validated on 2026-05-17 after the shared `portStore` popout slice:

```bash
pnpm -C devhub exec vitest run src/renderer/stores/portStore.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec eslint src/renderer/stores/portStore.ts src/renderer/stores/portPopoutStore.ts src/renderer/stores/portStore.test.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/components/monitor/PortView.tsx
pnpm -C devhub check:no-emoji
git -C devhub diff --check -- src/renderer/stores/portStore.ts src/renderer/stores/portPopoutStore.ts src/renderer/stores/portStore.test.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/components/monitor/PortView.tsx
```

Result: the shared renderer store now persists popout rows, trigger timing, and named layout presets through the same store that statusbar and renderer consumers already read; the compatibility alias keeps existing imports working without duplicating state.

Validated on 2026-05-17 after the Playwright Electron trigger/cap/position/sync matrix:

```bash
pnpm -C devhub exec vitest run src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-01" --workers=1 --reporter=line
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub check:zod-sot
git -C devhub diff --check
```

Result: renderer popout regression passed with 29 tests, and the real Electron `R8.B spec-01` matrix passed with 7 tests covering hover, click, context-menu, drag, floating cap, position-size memory, and BrowserWindow sync against real ephemeral TCP listener ports. Build, TypeScript, lint/no-emoji, no-cloud-deps, no-ocr-deps, Zod SoT, and diff whitespace gates passed.

## Boundaries

This slice now claims Playwright Electron e2e coverage for the spec-01 trigger, floating cap, position-memory, and sync matrix. The R8.B spec-02 RSS benchmark is now covered by `bench:popout-bw-rss` with 3-BrowserWindow and 8-BrowserWindow artifacts under `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/`. The spec-02 BrowserWindow drag-back path now has a real packaged Electron E2E that clicks the dedicated popout shell's `Return To Main` button and verifies the same-target floating record. It does not claim the remaining R8.B spec-02 multi-display BrowserWindow assertions. BrowserWindow promotion uses the existing generic R8 popout bridge under the `port:popout-open` wrapper, and port-specific demotion now uses the existing runtime `demotePopout()` path through `port:popout-demote`. Position get/save and the remaining port-specific control channels now have executable IPC coverage. Renderer floating popout counts and the live popout list are exposed through the shared renderer store and consumed by the statusbar tile without adding a new privileged count IPC path.
