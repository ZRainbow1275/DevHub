# R8.B Window Thumbnail Wall

This document records the implemented boundary for `prompts/0503-2/R8.B/spec-09-window-thumbnail-wall.md`.

## Implemented Slice

- The window tab now has a fourth renderer mode, `wall`, while keeping the existing `cards`, `list`, and `process` modes intact.
- `ThumbnailWall` renders real `WindowInfo` metadata from the existing window scanner path:
  - `hwnd`
  - `pid`
  - `title`
  - `processName`
  - `rect`
  - minimized and stale state
- `windowGroupKey` implements deterministic instance disambiguation over the R8.B five-tuple:
  - executable name
  - normalized title pattern
  - optional working directory
  - optional alias
  - optional launch order
- The renderer derives thumbnail entries through the shared Zod contract in `@shared/schemas/r8-runtime`.
- The wall supports four zoom levels: `xs`, `sm`, `md`, and `lg`.
- The toolbar supports filter text, group mode, refresh interval selection, visible counts, and selected-window counts.
- Group modes are implemented for `group`, `monitor`, `desktop`, `exe`, and `none`.
- Rows are rendered through `@tanstack/react-virtual` with a fallback projection for unit and static rendering environments.
- Tile click uses the existing `WindowOperationKind` path to focus the real window through `handleWindowOperation`.
- Ctrl/Cmd click and the tile checkbox update the existing `selectedWindows` set, so the pre-existing batch toolbar can operate on wall selections.
- The generic `ViewModeToggle` now emits `data-view-mode` attributes for R8.B/E2E selectors without changing its visual behavior.
- `ThumbnailService` captures real HWND thumbnails through a Win32 native path before falling back to Electron capture:
  - `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)` reads real DWM frame bounds.
  - `StretchBlt` copies the real visible HWND surface directly into the target thumbnail bitmap for the fast visible-window path.
  - `BitBlt` and `PrintWindow(PW_RENDERFULLCONTENT)` remain real GDI/Win32 fallbacks when the fast path cannot copy content.
  - `GetDIBits` and Electron `nativeImage.createFromBitmap(...).toDataURL()` produce real PNG data URLs.
- `ThumbnailService` uses `p-queue@8.1.0` with `THUMBNAIL_LIMITS.MAX_PARALLEL_CAPTURES = 4` and `THUMBNAIL_LIMITS.CAPTURE_TIMEOUT_MS = 800`.
- `WindowManager.getCachedWindows()` lets thumbnail refresh reuse the latest known HWND metadata instead of rescanning the whole desktop on every thumbnail batch.
- `ThumbnailService` keeps a bounded 30s virtual-desktop metadata cache so rapid thumbnail refreshes do not repeat Windows COM/registry desktop lookups for every HWND.
- The thumbnail IPC channels are executable through the existing window handler owner:
  - `window:thumbnails-batch`
  - `window:thumbnail-refresh`
  - `window:groups`
  - `window:set-alias`
  - `window:viewport-config`
- `WindowGroupResolver` persists aliases through the existing AI alias manager path and exposes grouped identities through `window:groups`.
- `ThumbnailService` integrates with the spec-11 virtual desktop provider and propagates real COM-backed Windows desktop GUIDs into `desktopId` when the OS resolves them.
- `useWindowThumbnails` consumes the real preload bridge and preserves the existing metadata-only rendering only as a truthful unavailable fallback.

## Thumbnail Boundary

No screenshot is fabricated.

The current slice implements native Win32 thumbnail capture. Successful captures return:

- `thumbnailDataUrl: data:image/png;base64,...`
- `capturedAt > 0`
- `isStale: false`
- `source: win32-printwindow`

If native capture is unavailable, the service falls back to Electron `desktopCapturer`, then cache/unavailable states. The renderer still shows explicit unavailable metadata instead of a fake screenshot.

## Contracts

The following shared schemas are present in `src/shared/schemas/r8-runtime.ts`:

- `windowThumbnailViewModeSchema`
- `thumbnailWallEntrySchema`
- `thumbnailWallViewportSchema`
- `thumbnailWindowGroupSchema`
- `THUMBNAIL_LIMITS`

The derived TypeScript types remain `z.infer` outputs:

- `WindowThumbnailViewMode`
- `ThumbnailWallEntry`
- `ThumbnailWallViewport`
- `ThumbnailWindowGroup`

## Virtual Desktop Boundary

- `desktopId` is populated only from the real spec-11 virtual desktop provider.
- The provider uses Windows COM/registry-backed discovery; unavailable COM, registry, or permission paths remain `null` or explicit unavailable states.
- The renderer never invents desktop IDs for grouping. `groupBy=desktop` groups resolved GUIDs and keeps unresolved windows in the truthful current/unavailable bucket.
- Virtual desktop metadata is cached for rapid refresh stability only; unresolved or unavailable provider results are still represented as `null`, not fabricated desktop IDs.

## Verification

Commands executed from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/utils/windowGroupKey.test.ts src/renderer/components/monitor/window/ThumbnailWall.test.tsx --maxWorkers=1 -t "R8.B"
pnpm -C devhub typecheck
pnpm -C devhub check:zod-sot
pnpm -C devhub exec eslint src/main/services/WindowManager.ts src/main/services/ThumbnailService.ts src/main/services/ThumbnailService.test.ts src/main/services/integrations/Win32ThumbnailCapturer.ts src/main/services/integrations/nativeImport.ts e2e/window-thumbnail-wall.spec.ts scripts/bench-thumbnail-capture.mjs --max-warnings=0
pnpm -C devhub exec eslint src/main/services/ThumbnailService.ts src/main/services/ThumbnailService.test.ts src/main/services/integrations/Win32ThumbnailCapturer.ts scripts/bench-thumbnail-capture.mjs --max-warnings=0
pnpm -C devhub exec vitest run src/main/services/ThumbnailService.test.ts --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub bench:thumbnail-capture
THUMBNAIL_CAPTURE_WINDOWS=100 THUMBNAIL_CAPTURE_MODE=per-window THUMBNAIL_CAPTURE_REPORT_PATH="D:/Desktop/CREATOR ONE/.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/thumbnail-capture-100hwnd-2026-05-19.json" pnpm -C devhub bench:thumbnail-capture
pnpm -C devhub test:e2e --grep "R8.B spec-09" --reporter=line
pnpm -C devhub test:e2e --grep "R8.B spec-11" --reporter=line
```

Results:

- Targeted thumbnail wall regression passed: 2 files, 8 tests passed, `--maxWorkers=1`.
- TypeScript typecheck passed.
- Zod SoT verification passed.
- Touched-file ESLint passed with zero warnings.
- `ThumbnailService.test.ts` passed with 1 file and 8 tests, including Win32 provider preference, cached `WindowManager` reuse, and rapid-refresh virtual-desktop metadata reuse.
- Production build passed; the only warning was the pre-existing Monaco static/dynamic import chunk warning.
- `bench:thumbnail-capture` passed with `sourceCounts.win32-printwindow = 3`, `targetWindowCount = 3`, `measuredCaptured = 3`, `totalCaptured = 9`, `p95 = 5.8ms`, and `p99 = 5.8ms` under the 200ms / 500ms budgets.
- The release-scale 100-HWND benchmark passed using 100 distinct real WinForms HWNDs across 10 bounded host processes, 100 measured captures, and report artifact `.trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/thumbnail-capture-100hwnd-2026-05-19.json`: `p95 = 10.8ms`, `p99 = 11.9ms`, `sourceCounts.win32-printwindow = 100`, `uniqueHwndCount = 100`, `totalCaptured = 300`.
- Electron Playwright `R8.B spec-09` passed with one real WinForms probe window, native PNG capture, group-key equality, alias persistence, and group membership verification.
- Electron Playwright `R8.B spec-11` passed with one real packaged Electron test covering real HWND `window:vd-info`, GUID `desktopId`, thumbnail-wall `desktopId` propagation, real monitor move, and truthful `MoveWindowToDesktop` success/error semantics.
