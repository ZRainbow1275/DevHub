# R8 Theme Seasonal And Visual Sync Contract

This document records the local implementation evidence for the `prompts/0503` B.6 and B.7 acceptance slice.

## Seasonal Themes

DevHub now ships three first-party seasonal theme packs:

| ID | User-facing name | Local date policy | Decoration pack | Prompt policy |
| --- | --- | --- | --- | --- |
| `spring-festival` | Spring Festival | Uses the annual Spring Festival table for 2026-2030, then falls back to the configured February seasonal window. | `golden`, global/header/card positions, red-gold CSS vars. | Prompts 14 days before the holiday date. |
| `christmas` | Christmas | December 25 every year. | `grid`, global/empty-state/statusbar positions, green-red CSS vars. | Prompts 21 days before the holiday date. |
| `halloween` | Halloween | October 31 every year. | `blocks`, global/card positions, orange-purple CSS vars. | Prompts 14 days before the holiday date. |

The resolver is implemented in `src/renderer/theme/theme-language.ts`:

- `HOLIDAY_THEME_DEFINITIONS` is the registry and contains the three production theme packs.
- `resolveHolidayTheme()` decides prompt, active, suppressed, enabled, and storage-key state from real local dates and persisted settings.
- `promptHolidayThemeIfNeeded()` asks once per holiday/year and stores `accepted` or `dismissed` in local storage.
- `resolveEffectiveThemeDecoration()` applies the active seasonal decoration only when enabled, accepted or in-date, and not suppressed by focus mode.
- `applyHolidayThemeToDocument()` writes `data-holiday-theme`, `data-holiday-prompt`, `data-holiday-focus-mode`, and holiday CSS variables onto `document.documentElement`.

## User Controls

`SettingsDialog` exposes a real `holiday-theme-settings` section with three controls:

- `Enable seasonal themes` controls whether holiday decorations can activate.
- `Ask before seasonal themes` controls annual pre-date prompts.
- `Focus work mode` suppresses every seasonal decoration layer without changing the saved base theme palette.

These settings are persisted as part of `AppearanceSettings`:

- `holidayDecorationsEnabled`
- `holidayAutoPromptEnabled`
- `holidayFocusMode`

The popout theme sync schema allows the same appearance fields, so BrowserWindow popouts do not lose the seasonal/focus contract during theme sync.

## Chart And Topology Sync

The theme token layer now defines chart and topology semantic tokens per palette:

- Chart tokens: `--chart-series-1`, `--chart-series-2`, `--chart-series-3`, `--chart-axis-color`, `--chart-grid-color`, `--chart-text-color`, `--chart-warning`.
- Topology tokens: `--topology-node-process`, `--topology-node-port`, `--topology-node-window`, `--topology-node-project`, `--topology-node-ai`, `--topology-node-label`, `--topology-edge-default`, `--topology-edge-network`, `--topology-edge-neural`, `--topology-edge-flow`.

Renderer integration points:

- `ProcessSparkline` defaults to `var(--chart-series-1)` and uses chart grid/warning tokens for missing-data markers.
- `StatusBarProcessHistoryWidget` passes the chart token into the live statusbar sparkline.
- `DagCanvas` reads computed topology tokens and applies them to the Cytoscape node and edge style sheet.
- `GraphCanvas` exposes `data-theme-sync="topology-palette"` and uses topology tokens in the hidden SVG export source.
- `TopologyMiniWidget` exposes `data-theme-sync="topology-palette"` and uses topology node/edge tokens for the dashboard mini graph.

High-contrast palettes (`cyberpunk` and `swiss`) define explicit text and graph colors rather than inheriting low-contrast defaults. The local verifier computes WCAG contrast against each palette's `--surface-950` background and requires chart/topology text tokens to be at least 4.5:1 while graph series, node, and edge tokens must be at least 3:1.

## Verification

Low-resource local commands:

```bash
pnpm -C devhub check:theme-seasonal-visual-contract
pnpm -C devhub exec vitest run src/renderer/theme/theme-language.test.ts src/renderer/components/settings/SettingsDialog.theme-editor.test.tsx --maxWorkers=1
pnpm -C devhub exec eslint src/renderer/theme/theme-language.ts src/renderer/hooks/useTheme.ts src/renderer/hooks/useDecoration.ts src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/dag-editor/DagCanvas.tsx src/renderer/components/topology/GraphCanvas.tsx src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx src/renderer/components/monitor/process/ProcessSparkline.tsx src/renderer/components/statusbar/StatusBarProcessHistoryWidget.tsx src/shared/types.ts src/shared/schemas/r8-runtime.ts --max-warnings=0
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
```

Completion boundary:

- This document is local implementation evidence for B.6.1-B.6.3 and B.7.1-B.7.3.
- It does not replace final user visual acceptance or multi-day real seasonal prompt observation.
