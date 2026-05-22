# R8.B Theme Decorations

## Scope

This document records the verified R8.B spec-07 theme decoration implementation currently shipped in DevHub.

The implementation is a real vertical slice across shared schemas, main-process storage/IPC, preload, renderer settings, renderer layers, custom SVG sanitization, optional theme sounds, Electron E2E, and a production-renderer benchmark. It does not use mock SVG entries, fake sound state, simulated IPC, or synthetic screenshots.

## Implemented Runtime Path

The current flow is:

1. `themeDecorationConfigSchema`, `customSvgEntrySchema`, `themeSoundConfigSchema`, and related request/response schemas live in `src/shared/schemas/r8-runtime.ts` and remain the Zod single source of truth.
2. `AppSettings.appearance.decoration` stores the selected decoration config, while palette switching still resolves safe defaults through `resolveThemeDecoration`.
3. `applyThemeDecorationToDocument` writes decoration metadata and CSS variables onto `document.documentElement`.
4. `useDecoration` loads persisted settings, applies the layer, listens for `devhub:theme-decoration-change`, and persists user updates.
5. `ThemeDecoration` renders built-in and sanitized custom SVG decorations as non-interactive `aria-hidden` overlays.
6. `App`, `TitleBar`, `ProjectList`, `ProjectCard`, and `StatusBar` inject the same resolved decoration config into `global-background`, `header`, `detail-panel-background`, `card-background`, `empty-state`, and `statusbar-background` surfaces without per-card settings reads.
7. `SettingsDialog` exposes decoration kind, blend mode, opacity, scale, target positions, custom SVG upload/delete, and per-theme sound controls.
8. `R8RuntimeService` owns executable `theme:*` IPC handlers through `r8RuntimeHandlers`, and the preload bridge exposes only typed theme decoration methods.

## Built-In Decorations

The built-in set contains eight non-custom decorations:

| Kind | Purpose |
|---|---|
| `soviet-geo` | Constructivist diagonal geometry, corner blocks, and hard accent lines. |
| `diagonals` | Low-noise diagonal line texture. |
| `paper` | Paper/noise surface using existing theme texture variables. |
| `scanline` | Cyberpunk scanline overlay driven by existing animation tokens. |
| `grid` | Precision grid background. |
| `golden` | Golden-ratio guide lines and curve. |
| `noise` | Sparse dot/noise field. |
| `blocks` | Large color-block composition. |

`none` disables the layer. `custom-svg` renders only persisted sanitized SVG content returned by the main-process store.

## Palette Defaults

Palette switching resolves a default decoration when no explicit user override is present:

| Palette | Default Decoration | Default Opacity | Positions |
|---|---|---:|---|
| `constructivism` | `soviet-geo` | `0.25` | `card-background`, `header` |
| `modern-light` | `diagonals` | `0.08` | `global-background` |
| `warm-light` | `paper` | `0.12` | `global-background`, `card-background` |
| `cyberpunk` | `scanline` | `0.16` | `global-background`, `header` |
| `swiss` | `grid` | `0.06` | `global-background` |
| `dark` | `noise` | `0.08` | `global-background` |
| `light` | `golden` | `0.07` | `global-background` |

Opacity is validated by schema rules to `0..0.5`.

## Security Boundary

Custom SVG upload is enabled only through a double validation path:

- Renderer upload uses `SvgSanitizer`, `DOMPurify.sanitize`, `USE_PROFILES: { svg: true, svgFilters: true }`, explicit forbidden tags/attributes, and `ALLOW_DATA_ATTR: false`.
- Shared validation in `validateSanitizedSvgContent` rejects empty content, non-`<svg>` roots, XML entity/stylesheet declarations, forbidden tags, event handler attributes, forbidden `href`/`src`/`style` attributes, script URLs, remote URLs, and HTML data URLs.
- Main-process `CustomSvgStore` revalidates content before persistence, limits custom SVG count to 50, limits SVG size to 200KB, stores sanitized content only, records SHA256 hashes, and drops malformed persisted rows defensively.
- Custom SVG mutation IPC channels are confirmation-gated through the R8 IPC registry and shared rate-limit middleware.
- Renderer display uses `dangerouslySetInnerHTML` only for sanitized content returned from the typed preload bridge.

## Theme Sounds

Theme sounds are optional and disabled by default. `ThemeSounds.ts` provides seven local data-URI tone defaults, one per `ThemeOption`, and loads them through `howler` only when the persisted `ThemeSoundConfig.enabled` flag is true.

Playback is fail-closed:

- load errors mark a sound key failed and unload/delete the Howl instance;
- play errors unload/delete the instance and return `false`;
- missing preload or IPC support falls back to the disabled default config;
- core UI interactions continue in silent mode when audio is unavailable.

## Verification

Low-resource gates used for this slice:

```bash
pnpm -C devhub test --run src/renderer/services/SvgSanitizer.test.ts src/main/services/CustomSvgStore.test.ts src/renderer/services/ThemeSounds.test.ts src/renderer/theme/theme-language.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm -C devhub test --run src/renderer/services/ThemeSounds.test.ts src/renderer/i18n/i18n.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm -C devhub test --run src/renderer/services/ThemeSounds.test.ts src/renderer/theme/theme-language.test.ts src/renderer/i18n/i18n.test.ts --maxWorkers=1
pnpm -C devhub test --run src/renderer/theme/theme-language.test.ts --maxWorkers=1 -t "decoration|theme language|palette"
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.B spec-07 theme decoration custom SVG" --reporter=line
pnpm -C devhub bench:theme-decoration
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
```

Current concrete evidence:

- Unit and IPC checks: 5 files / 40 tests passed for sanitizer, store, sounds, theme language, and theme IPC routing.
- Focused follow-up checks: 3 files / 32 tests passed for sounds, i18n, and IPC; then 3 files / 14 tests passed for sounds, theme language, and i18n.
- `pnpm -C devhub typecheck` passed.
- `pnpm -C devhub build` passed and generated production `out/main`, `out/preload`, and `out/renderer` bundles.
- Electron E2E passed for built-in count, safe SVG upload, persisted custom SVG config, custom SVG rendering, malicious SVG rejection, multi-position layer presence, and persisted sound config.
- `bench:theme-decoration` passed with 900 real Electron renderer samples, all 8 built-ins plus `custom-svg`, `missingKinds: []`, `p95: 0.1ms`, and `p99: 0.1ms` under the 16ms budget.
