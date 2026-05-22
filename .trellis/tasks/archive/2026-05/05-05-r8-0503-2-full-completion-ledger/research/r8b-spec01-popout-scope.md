# R8.B spec-01 Port Popout Scope Closure Notes

Updated: 2026-05-17

## Source Scope

- Spec source: `prompts/0503-2/R8.B/spec-01-port-popout-system.md`.
- Existing runtime evidence: `devhub/src/shared/schemas/r8-runtime.ts`, `devhub/src/main/services/R8RuntimeService.ts`, `devhub/src/main/ipc/r8RuntimeHandlers.ts`, `devhub/src/preload/index.ts`, and `devhub/src/renderer/types/global.d.ts` now expose executable port-specific popout IPC wrappers on top of the existing BrowserWindow bridge.
- Renderer gap before this pass: `devhub/src/renderer/components/monitor/PortView.tsx` had card selection and the right-side `PortFocusPanel`, but no four-trigger floating port card surface.

## Implemented Vertical Slice

- Added renderer floating port popout model and manager under `devhub/src/renderer/components/popout/`.
- Added `PortPopoutCard`, `PortPopoutTitleBar`, `PortPopoutResizeHandles`, `PopoutTriggerLayer`, and `PortPopoutHost` using existing DevHub visual primitives and icon library.
- Wired `PortView` card view to open popouts from four real triggers:
  - hover after `1000ms`;
  - explicit card action click;
  - drag movement at or above `8px`;
  - context menu.
- Added local position/size memory via `localStorage` using stable `port:pid` keys.
- Added `devhub/src/main/services/PopoutPositionStore.ts` backed by real `electron-store`, plus executable `port:popout-position-get` and `port:popout-position-save` handlers through `R8RuntimeService`, `r8RuntimeHandlers`, preload, and renderer `usePortPopoutManager`.
- Added executable `port:popout-open`, `port:popout-close`, `port:popout-list`, `port:popout-pin`, `port:popout-batch`, and `port:popout-sync` wrappers through `R8RuntimeService`, `r8RuntimeHandlers`, preload, and renderer/global typings so port-specific IPC no longer stops at schema registration.
- Added real RSS budget monitoring and auto-evict logic for live BrowserWindow popouts, with per-popout and total thresholds, pin-aware eviction ordering, and a monitor lifecycle that stays silent under test.
- Added executable `port:popout-demote` as a port-scoped wrapper around the existing spec-02 `demotePopout()` implementation. The wrapper validates active port BrowserWindow records, preserves `port:<port>:pid:<pid>`, and returns the new floating port runtime record.
- Renderer popouts now hydrate missing `localStorage` geometry from the main-process store by current port number and mirror move/resize geometry back to the store without blocking the UI.
- Enforced `MAX_FLOATING = 5`, oldest-unpinned eviction, all-pinned block behavior, and z-index allocation in the `4000..4999` popout tier.
- Centralized port-popout trigger, sync-policy, geometry, z-index, limit, and popout record schemas in `devhub/src/shared/types-extended.ts`.
- Added `local/no-hardcoded-inline-z-index` to `devhub/eslint.config.js` and migrated existing inline renderer numeric z-index literals to CSS token values.
- Added `usePopoutSync` for debounced bridge-backed port view state sync, plus main-process generic sync broadcast from source popouts to main/peer windows and from main to live BrowserWindow popouts.
- Wired the card promote action to the existing secure `window.devhub.r8.popout.create` BrowserWindow bridge without introducing a new IPC bridge.
- Synchronized open floating cards with the latest real `PortInfo` rows from `usePorts`; unpinned cards disappear when the backing port disappears.
- Wired command-palette popout requests, persisted trigger settings, persisted sync-policy defaults for new renderer popouts, and shared renderer store statusbar counts.
- Added a shared `portStore` popout slice and a compatibility `portPopoutStore` bridge so the live popout list, trigger toggles, timing bounds, and layout presets now live in one renderer-side source of truth.
- Added real titlebar minimize/restore and theme-isolate/restore actions. Minimize keeps the popout entry and active count while hiding card content; theme isolation toggles `syncPolicy.theme=false` and `direction='isolated'`, then restores the current persisted/default policy.
- Added focused utility tests for the stable position-memory key normalization and the popout-band z-index allocator.

## Verification Evidence

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub exec vitest run src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts -t "broadcasts generic popout sync" --maxWorkers=1
pnpm -C devhub exec vitest run src/shared/types-extended.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/PopoutPositionStore.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/PopoutPositionStore.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/renderer/components/monitor/PortView.port-popout.test.tsx --maxWorkers=1 -t "port popout position|BrowserWindow popout lifecycle channels|validates port popout position persistence contracts|hydrates remembered popout geometry from the main popout position store bridge|resizes a floating port card and restores the same-port size on reopen"
pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "covers every IPC channel declared|validates port popout position persistence contracts"
pnpm -C devhub exec vitest run src/preload/preloadContract.test.ts --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub exec eslint src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts
pnpm -C devhub exec eslint src/renderer/components/ui/ScriptSelector.tsx src/renderer/components/ui/ThemeDecoration.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutTitleBar.tsx
git -C devhub diff --check -- src/renderer/components/popout/PortPopoutTitleBar.tsx src/renderer/components/popout/PortPopoutCard.tsx src/renderer/components/popout/PortPopoutHost.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/PortView.port-popout.test.tsx src/renderer/components/popout/port-popout-model.test.ts src/renderer/components/popout/port-popout-model.ts src/renderer/components/popout/usePortPopoutManager.ts src/renderer/utils/popoutPositionMemory.test.ts src/renderer/utils/popoutZIndexAllocator.test.ts docs/r8/port-popout.md
```

Results:

- Shared-contract plus port popout targeted regression passed: 5 files, 44 tests, `--maxWorkers=1`.
- Utility regression passed: 2 files, 6 tests, `--maxWorkers=1`.
- Sync bridge focused regression passed: 1 service test plus 32 shared/renderer tests, `--maxWorkers=1`.
- Main-process position store regression passed: real temporary `electron-store` persistence, malformed record filtering, R8RuntimeService reload, executable IPC handler routing, preload whitelist synchronization, renderer hydration, and resize-save bridge coverage.
- TypeScript no-emit check passed.
- No-emoji guard passed.
- Targeted ESLint passed, including the inline z-index lint rule.
- Targeted diff whitespace check passed.

- 2026-05-17 RSS auto-evict slice passed with the port-specific service regression, TypeScript, no-emoji, and diff checks.
- 2026-05-17 port-specific demote interop slice passed with the focused service regression plus combined IPC/service/preload whitelist regression.

## Remaining Boundaries

- The shared renderer `portStore` popout slice is now present; the compatibility bridge remains only for existing imports and statusbar consumption.
- Port-specific main-process IPC is now executable for `port:popout-position-get`, `port:popout-position-save`, `port:popout-open`, `port:popout-close`, `port:popout-list`, `port:popout-pin`, `port:popout-batch`, `port:popout-sync`, and `port:popout-demote`; BrowserWindow promotion still uses the existing generic `popout:create` bridge underneath the wrapper, and BrowserWindow demotion reuses the existing generic `demotePopout()` runtime path.
- Playwright/Electron e2e and RSS memory-leak benchmark remain open for later closure.
