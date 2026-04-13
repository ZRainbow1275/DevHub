# Code Review Remaining Issues Implementation

## Goal
Implement all 15 remaining issues (6 design documents + 9 direct fixes) from the 5-agent code review conducted on 2026-04-12. Total original: 42 issues, 25 fixed, 17 remaining (2 already fixed = 15 to implement).

## Source Documents
All specs in `prompts/0413/`:
- `00-remaining-issues-overview.md` - Master overview
- `01-zustand-selector-refactor.md` - D1: Zustand selector granularity
- `02-terminal-signal-fusion.md` - D2: Terminal signal fusion for AI task detection
- `03-theme-runtime-manager.md` - D3: Theme runtime manager
- `04-font-bundling-strategy.md` - D4: Font local bundling
- `05-scanner-subscribe-lifecycle.md` - D5: ALREADY FIXED
- `06-window-rename-chain.md` - D6: Window rename chain
- `07-aitask-confidence-state.md` - D7: AI task confidence state

## Requirements

### Design Documents (D-series)
- [x] D5: Scanner Subscribe Lifecycle (already fixed)
- [x] D1: Zustand Selector refactor - useShallow for >4 fields, individual selectors for <=4
- [x] D2: Terminal Signal Fusion - Real I/O counters (Signal 3) + child process tree detection (Signal 5)
- [x] D3: Theme Runtime Manager - fontStatus state, async font preload, CSS duration reading
- [x] D4: Font Bundling - @fontsource packages replacing 10 Google CDN @font-face declarations
- [x] D6: Window Rename Chain - Multi-level alias lookup + renameAlias with optimistic update
- [x] D7: AI Task Confidence State - detectionSignals field on AITask, frontend store cache

### Direct Fixes (I-series)
- [x] I7: Scanner WeakSet (already fixed)
- [x] I1: windowStore applyLayoutPreset method (Tile/Cascade/Master-Slave)
- [x] I2: aliasStore startup auto hydration (was already implemented)
- [x] I3: IPC Zod schema validation for processHandlers (pid/filePath/priority) + windowHandlers (hwnd/coordinates/opacity)
- [x] I4: tailwind.config.js screens breakpoints alignment (verified: already consistent with useBreakpoint)
- [x] I5: formatMetric.ts exhaustive switch with assertNever helper
- [x] I6: saveLayoutOnExit - layout save on app before-quit
- [x] I8: AITaskStatistics exported from types-extended.ts, aiTaskStore imports from shared
- [x] I9: security.ts venv detection unified (requirements.txt + optional venv dir)
- [x] I10: ProcessView cpu/memory toFixed NaN protection with isFinite guard

## Acceptance Criteria
- [x] All 15 items implemented and verified
- [x] TypeScript compilation passes (tsc --noEmit) - 0 errors
- [x] ESLint passes with no new errors - 0 errors, 1 pre-existing warning
- [ ] Build succeeds (pnpm build) - to be tested by user
- [x] No existing functionality broken or removed
- [x] No mock data or simulated operations
- [x] No emoji icons used (use installed icon libraries)

## Constraints
- No major refactoring beyond specified changes
- No deletion of existing features, modules, or components
- Follow existing code style and design philosophy
- All icons must use installed icon libraries, no emoji
