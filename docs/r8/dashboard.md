# R8.B Dashboard Grid

## Scope

`prompts/0503-2/R8.B/spec-05-dashboard-grid-layout.md` is implemented as a verified slice. The slice adds a draggable dashboard page without replacing the existing three-pane monitor workflow.

## Runtime Boundary

- Renderer route: `src/renderer/components/dashboard/Dashboard.tsx`.
- Widget registry: `src/renderer/components/dashboard/WidgetRegistry.tsx`.
- Layout store: `src/renderer/stores/dashboardStore.ts` and `src/renderer/hooks/useDashboardLayout.ts`.
- Runtime persistence: `R8RuntimeService` stores dashboard layouts in the existing `devhub-r8-runtime` `electron-store`.
- Feature flag: `R8.B.dashboard.grid` is enforced by runtime IPC and the Dashboard route renders a disabled surface instead of mounting `react-grid-layout` when the flag is off.
- IPC channels:
  - `dashboard:get-layout`
  - `dashboard:save-layout`
  - `dashboard:list-presets`
  - `dashboard:delete-preset`
  - `dashboard:reset`
  - `dashboard:morph-widget-to-drawer`
  - `feature:get-flag`
  - `feature:set-flag`

## Widgets

The default dashboard contains eight lazy-loaded widgets. All widgets read current application state or runtime IPC; no mock dataset is bundled into the production renderer.

| Widget | Source | Purpose |
|---|---|---|
| `process-summary` | `useScannerStore.processes` and `systemSummary` | Process count and top CPU rows |
| `port-summary` | `useScannerStore.ports` and `systemSummary` | Active port count and protocol grouping |
| `window-summary` | `useScannerStore.windows` and `systemSummary` | Window count, visible count, visible window rows |
| `ai-task-queue` | `useScannerStore.aiTasks` and `systemSummary` | Active AI task count and tool grouping |
| `system-resource` | `useScannerStore.summary` | CPU and memory usage bars |
| `notifications` | `window.devhub.r8.status.aggregate()` | Notification count and warning/danger badges |
| `topology-mini` | scanner process/port/window joins | Lightweight node and edge overview |
| `treemap-mini` | `useScannerStore.processes` | CPU/RSS weighted process ranking |

## Presets

The runtime exposes four built-in presets:

- `default`
- `minimal`
- `monitor-focus`
- `ai-focus`

User presets can be persisted through `dashboard:save-layout`. Built-in presets cannot be deleted; custom presets can be deleted through `dashboard:delete-preset`.

## Widget Configuration

The widget frame exposes a configure action for every dashboard widget. `DashboardWidgetConfigEditor` loads widget-specific Zod-backed field definitions from `dashboard-widget-config.ts`, normalizes user input, and writes the config back through `dashboard:save-layout` via `updateWidgetConfig()`.

Supported per-widget config includes:

- Row limits for process, port, window, AI task, notification, topology, and treemap summaries.
- Visibility and tone filters for window and notification widgets.
- CPU/RSS weighting, bar visibility, and node-count bounds for resource and topology widgets.
- Treemap range selection across `cpu`, `rss`, and `handles`.

Config is stored on every matching responsive breakpoint item for the widget instance, so breakpoint changes do not discard widget settings.

## Command Palette Integration

`R8RuntimeService.listCommands()` includes:

- `dashboard.open`
- `dashboard.layout.default`
- `dashboard.layout.minimal`
- `dashboard.layout.monitor-focus`
- `dashboard.layout.ai-focus`

Invoking these commands emits `r8:command-event` and the renderer opens the dashboard or applies the selected layout preset.

## Drawer Integration

Each registered widget can be morphed to the right or bottom Drawer through `dashboard:morph-widget-to-drawer`. The runtime removes the widget instance from the default dashboard layout and opens the target Drawer slot with a mapped content ID.

## Feature Flag Surface

`R8.B.dashboard.grid` can be toggled from both the Dashboard page and the Settings advanced page. The off state is not a mock route: it persists through the shared runtime feature flag bridge and prevents the grid and widgets from mounting until the flag is re-enabled.

## Drag Benchmark

`pnpm -C devhub bench:dashboard` builds the production Dashboard bundle and drives a real Chromium pointer drag over `react-grid-layout`.

The 2026-05-16 run produced:

- `passed: true`
- `dragIterations: 1000`
- `averageFps: 60`
- `p95: 16.7ms`
- `moved: true`
- `persisted: true`
- `saveCountDelta: 2`

## Validation

Verified with low-resource commands from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/components/dashboard/dashboard-model.test.ts src/renderer/components/settings/SettingsDialog.statusbar.test.tsx --maxWorkers=1
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-05" --workers=1 --reporter=line
pnpm -C devhub bench:dashboard
pnpm -C devhub exec eslint src/renderer/components/dashboard/Dashboard.tsx src/renderer/components/dashboard/WidgetRegistry.tsx src/renderer/components/dashboard/dashboard-model.ts src/renderer/components/dashboard/dashboard-widget-config.ts src/renderer/components/dashboard/widgets/ProcessSummaryWidget.tsx src/renderer/components/dashboard/widgets/PortSummaryWidget.tsx src/renderer/components/dashboard/widgets/WindowSummaryWidget.tsx src/renderer/components/dashboard/widgets/AiTaskQueueWidget.tsx src/renderer/components/dashboard/widgets/SystemResourceWidget.tsx src/renderer/components/dashboard/widgets/NotificationsWidget.tsx src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx src/renderer/components/dashboard/widgets/TreemapMiniWidget.tsx src/renderer/stores/dashboardStore.ts src/renderer/hooks/useDashboardLayout.ts src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx e2e/example.spec.ts scripts/bench-dashboard-drag.mjs
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
git -C devhub diff --check -- package.json scripts/bench-dashboard-drag.mjs e2e/example.spec.ts src/renderer/components/dashboard/Dashboard.tsx src/renderer/components/dashboard/WidgetRegistry.tsx src/renderer/components/dashboard/dashboard-model.ts src/renderer/components/dashboard/dashboard-model.test.ts src/renderer/components/dashboard/dashboard-widget-config.ts src/renderer/components/dashboard/widgets/ProcessSummaryWidget.tsx src/renderer/components/dashboard/widgets/PortSummaryWidget.tsx src/renderer/components/dashboard/widgets/WindowSummaryWidget.tsx src/renderer/components/dashboard/widgets/AiTaskQueueWidget.tsx src/renderer/components/dashboard/widgets/SystemResourceWidget.tsx src/renderer/components/dashboard/widgets/NotificationsWidget.tsx src/renderer/components/dashboard/widgets/TopologyMiniWidget.tsx src/renderer/components/dashboard/widgets/TreemapMiniWidget.tsx src/renderer/hooks/useDashboardLayout.ts src/renderer/stores/dashboardStore.ts src/renderer/components/settings/SettingsDialog.tsx src/renderer/components/settings/SettingsDialog.statusbar.test.tsx
git diff --check -- prompts/0503-2/R8.B/spec-05-dashboard-grid-layout.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md devhub/docs/r8/dashboard.md
pnpm -C devhub build
```

The production build still reports the existing Monaco dynamic/static import warning from `SkillEditorPanel.tsx` and `GitDiffTrack.tsx`; it does not block this dashboard slice.

## Completion Boundary

- `R8.B spec-05` is verified for dashboard route, widget registry, real data widgets, IPC persistence, restart persistence, widget configuration, feature-flag disabled surface, Drawer morph, command-palette preset events, targeted E2E, benchmark, build, lint, typecheck, no-emoji, and Zod SoT.
- Process treemap ownership belongs to `R8.B spec-06`, which is tracked separately in the completion ledger and already has its own verified implementation evidence.
