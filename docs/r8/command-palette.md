# R8.B Command Palette

## Scope

This document records the implemented R8.B spec-04 slice. The current build has a real `cmdk` renderer surface, `Ctrl+K` global launcher, command registry, scanner-backed 100+ runtime object commands, command history, recent-history UI, Fuse.js fuzzy ranking with frequency plus recency-decay history boosting, Fuse title match highlighting, 1000-entry search benchmark coverage, scope-prefix category filtering, five-scope information architecture evidence, process/port/window/AI/theme/settings source-group evidence, Drawer command integration, backend BrowserWindow port-popout command integration, command-palette theme switching through the existing `useTheme` persistence path, settings-visible OS protocol registration, ESC focus restoration, custom command storage IPC, Settings Advanced custom-command management UI, safe declarative custom command execution, executable URI resolution IPC, real packaged Electron Playwright coverage for the command-palette happy path, and real OS-protocol handoff coverage through `shell.openExternal()` plus the single-instance deep-link bridge. Arbitrary shell, JavaScript, SKILL, and eval-like command execution is intentionally unsupported in R8.

## Runtime Path

- Renderer palette: `src/renderer/components/command/R8CommandPalette.tsx`.
- Global shortcut registry: `src/renderer/hooks/useGlobalShortcuts.ts`.
- Global shortcut host wiring: `src/renderer/App.tsx`.
- Main command registry and invocation: `src/main/services/R8RuntimeService.ts`.
- OS protocol registration and external URI handoff: `src/main/services/R8RuntimeService.ts`, `src/main/index.ts`, and `src/renderer/components/settings/SettingsDialog.tsx`.
- URI resolver: `R8RuntimeService.resolveCommandUri`.
- IPC registration: `src/main/ipc/r8RuntimeHandlers.ts`.
- Preload bridge: `src/preload/index.ts`.
- Shared schemas: `src/shared/schemas/r8-runtime.ts`.

## Implemented Commands

The runtime registry currently includes navigation, monitor, diagnostics, and Drawer commands:

- `monitor.process`
- `monitor.port`
- `monitor.window`
- `monitor.ai-task`
- `ai.tasks.open`
- `settings.open`
- `popout.port`
- `topology.global`
- `topology.flow`
- `drawer.notifications`
- `drawer.observability`
- `drawer.statusbar`
- `dashboard.open`
- `dashboard.layout.default`
- `dashboard.layout.minimal`
- `dashboard.layout.monitor-focus`
- `dashboard.layout.ai-focus`
- `theme.apply.constructivism`
- `theme.apply.modern-light`
- `theme.apply.warm-light`
- `theme.apply.cyberpunk`
- `theme.apply.swiss`
- `theme.apply.dark`
- `theme.apply.light`
- `process.view.tree`
- `process.view.treemap`
- `process.batch.tag`
- `port.blocklist.add`
- `diagnostics.export`

Drawer commands are delivered through `r8:command-event` and consumed by the R8.B spec-03 `DrawerProvider`. The `ai.tasks.open` command routes to the existing live AI task monitor tab, and `settings.open` sends `settings-open`, which `App` consumes by opening the real `SettingsDialog`. The `theme.apply.*` commands send `theme-apply` with a typed palette payload; `App` validates it through `paletteNameSchema` before calling the existing `useTheme().setTheme()` path, so command-palette theme switching uses the same persisted settings and theme-axis pipeline as Settings. The `popout.port` command calls the executable R8.B spec-02 `createPopout()` service path with `{ surface: 'port', mode: 'browserwindow' }`; the renderer `popout <port>` affordance uses that backend command first and only falls back to the existing renderer floating-card request if the backend command rejects. The `process.batch.tag` command navigates to the Process monitor and emits a renderer event that opens the real batch-tag dialog for already selected processes.

The runtime registry is no longer limited to the static list above. `command:list` also adds scanner-backed object commands from the real `ScannerCache`: up to 80 process commands (`process.open.<pid>`), 40 port commands (`port.open.<port>.<pid>`), and 40 window commands (`window.open.<hwnd>`). These entries use `handler: 'uri:open'`, resolve through the executable `devhub://` URI parser, reject stale missing targets, and emit the same `protocol-open` command event consumed by the renderer. The same scanner rows also add object relationship commands (`topology.process.<pid>`, `topology.port.<port>.<pid>`, `topology.window.<hwnd>`) with `handler: 'topology:open'`, validated `devhub://` targets, concrete global graph node ids, and Chinese/pinyin/English discovery keywords for topology and relationship queries. The packaged Electron spec-04 E2E waits for at least 100 real registry entries before exercising the palette.

## Five-Scope Information Architecture

`ASSERT_COMMAND_PALETTE_5_SCOPES` is covered for the implemented command registry without fabricating empty groups. When persisted command history exists, the default palette renders all five required information-architecture groups:

- 最近: `cmdk-group-history`, backed by persisted `CommandHistoryEntry` rows.
- 命令: `cmdk-group-monitor`, backed by executable monitor commands.
- 跳转: `cmdk-group-navigation`, backed by monitor/dashboard/topology navigation commands.
- AI 动作: `cmdk-group-ai-action`, backed by executable `ai.tasks.open`.
- 设置: `cmdk-group-settings`, backed by executable `settings.open` and `theme.apply.*`.

Each rendered group heading includes a shared icon-library icon and a numeric count badge through deterministic `cmdk-group-<category>-heading` and `cmdk-group-<category>-count` markers. The assertion is covered by renderer DOM tests, runtime command invocation tests, and the packaged Electron `R8.B spec-04` Playwright scenario for the implemented default registry. A local source-group regression also verifies representative process, port, window, AI, theme, settings, and command entries are visible without placeholder groups.

## URI Resolution

The executable `command:resolve-uri` channel accepts `devhub://<scope>/<id>` with optional query parameters:

- `devhub://port/3000`
- `devhub://process/8812?fallback=exe:node.exe,cwd:D:/repo/devhub`
- `devhub://window/123`

The resolver parses the URI, validates the scope, checks the live scanner snapshot when available, and reports whether the target currently exists. Process fallback uses `exe` and `cwd` keys against scanner process rows. It does not fake navigation success when the target is missing.

## OS Protocol Registration

The executable `command:register-os-protocol` channel is exposed through preload as `window.devhub.r8.command.registerOsProtocol(register, confirmedBy)` and is surfaced in Settings -> Advanced -> External URI Protocol. It is confirmation-gated and calls Electron's default-protocol APIs for the `devhub` scheme:

- Development mode uses `process.execPath` plus the resolved app entry argument when `process.defaultApp` is active.
- Packaged mode uses the current executable default.
- The result reports whether Electron accepted the action and whether `devhub` is currently the default protocol handler.
- Main process `second-instance` and macOS `open-url` events extract `devhub://` URIs, focus the existing main window, and forward `{ type: 'protocol-open', uri }` through the existing `r8:command-event` bridge.
- Renderer App resolves the forwarded URI through `command.resolveUri()` and routes monitor targets to the relevant monitor tab.
- The packaged Electron `R8.B spec-04` E2E registers `devhub://` only when the current test app is not already the default handler, calls Electron `shell.openExternal()` with a real scanner-backed `devhub://process/<pid>` URI, and verifies the exact URI arrives at the renderer through `window.devhub.r8.command.onEvent`.

## Scope Prefix Filtering

The palette recognizes a single leading scope prefix before normal text matching:

- `>` narrows the visible registry to navigation, monitor, and diagnostics commands.
- `@` narrows the visible registry to AI/model/agent related commands, using category plus id/title/description/keyword matching.
- `#` narrows the visible registry to object commands for ports, processes, and windows.
- `!` narrows the visible registry to commands marked `requiresConfirmation`.

When a prefix is active, the UI shows a deterministic `data-testid="cmdk-scope-filter"` chip and keeps `cmdk` filtering active by stripping only the leading prefix from the search term. The same scope rule is applied to the recent-history group by first resolving history rows back to their real command entries, so a historical item does not bypass the current scope.

## Search Ranking

Command filtering now uses `fuse.js` from the renderer bundle instead of relying on `cmdk` default string filtering. The search index is built from each real command entry's id, title, label, description, category, scope, uri, and keywords.

Ranking uses weighted Fuse.js keys and then applies a bounded history boost from persisted `CommandHistoryEntry` rows:

- Title, keywords, id, and description carry the highest Fuse weights.
- `useCount` contributes up to `0.12` score improvement after capping at 10 uses.
- Recent LFU/LRU rank contributes up to `0.08` score improvement for the strongest recent rows.
- Relative recency decay contributes up to `0.06` score improvement based on each command's latest persisted invocation compared with the newest history row.
- Lower combined score wins; command invocation still uses the real `command:invoke` path.

This is a production-path search implementation. Matched title ranges from Fuse.js are rendered with `data-testid="cmdk-match-highlight"` without replacing the command text. The production helper is covered by a 1000-entry generated workload benchmark in `src/renderer/components/command/command-search.test.ts`; the helper caches Fuse indexes per stable entry list and prefilters large command sets before running Fuse.

## Custom Commands

Custom command storage is now on the real R8 runtime path:

- `command:save-custom` persists local custom commands in the existing electron-store runtime slice.
- `command:list-custom` returns stored commands through the preload bridge without mock data.
- `command:history-add` writes a standalone `CommandHistoryEntry` into the same bounded LFU/LRU history store used by `command:invoke`.
- `CustomCommand` is a Zod source-of-truth schema and rejects `handlerScript` values containing `eval()` or `Function()`.
- `command:save-custom` requires a real `confirmedBy` value before writing.
- Enabled custom commands are merged into `command:list` as real command entries with `handler: 'custom'`.
- `command:<id>` handler scripts invoke an existing non-custom command through the same `invokeCommand()` path.
- `devhub://...` handler scripts resolve through the same URI parser and forward a `protocol-open` command event to the renderer when a main window is live.
- Settings -> Advanced -> 命令面板自定义命令 lists saved commands, saves `id` / `label` / `handlerScript` / `shortcut` / `enabled`, edits existing rows, and disables commands through the same `command:save-custom` bridge.

This slice intentionally does not execute arbitrary shell, JavaScript, SKILL, or eval-like handler strings. Unsupported handler forms return `E_UNSUPPORTED_CUSTOM_COMMAND` instead of pretending success.

## Completion Boundary

Implemented and validated:

- `cmdk` palette renders with deterministic `data-testid="command-palette"`.
- `Ctrl+K` and `Meta+K` toggle the palette through the shared `useGlobalShortcuts` registry, while `Ctrl+T` and `Meta+T` open global topology through the same registry.
- `topology.flow` opens the same fullscreen topology surface with a one-shot `graphKind: 'flow'` intent instead of requiring the user to open topology first and then click the flow switcher.
- Global shortcuts ignore editable targets by default and can explicitly opt into editable targets.
- When the palette opens through the host, `App` records the previously focused element and passes it to `R8CommandPalette`; Escape, command invocation, URI resolution, and port-popout requests close the palette through the same focus-return path.
- Persisted command invocations are exposed through the typed `CommandHistoryEntry` Zod schema and rendered as a recent-history group capped at 10 visible items.
- Runtime command history is deduplicated by command id, tracks `useCount`, and retains at most 50 rows through LFU+LRU ordering.
- Standalone `command:history-add` is executable and writes through the same bounded command-history store.
- Custom command save/list IPC is executable, confirmation-gated on save, Zod-validated, and rejects eval-capable handler scripts.
- Enabled custom commands are visible in the command registry and safely execute only `command:<id>` and `devhub://...` handler forms.
- The default runtime registry exposes executable `ai.tasks.open` and `settings.open` commands, so the palette can render the required AI action and settings groups without empty placeholders.
- The default runtime registry exposes executable `theme.apply.*` commands, and `App` consumes `theme-apply` through the same validated `useTheme().setTheme()` path used by Settings.
- Renderer tests verify process, port, window, AI, theme, settings, and command source groups with representative real command entries.
- Command-group headings use installed icon-library tokens and numeric count badges, and the renderer assertion verifies visible recent, command, jump, AI action, and settings groups.
- `fuse.js` 7.3.0 is installed and used for typo-tolerant command filtering with weighted keys and bounded persisted-history boosting from use count plus recency decay.
- Fuse.js title match ranges are rendered as inline highlights while preserving each command option's complete accessible text.
- `searchCommandEntries()` is extracted to `src/renderer/components/command/command-search.ts` and covered by a 1000-entry P99 < 16ms benchmark regression.
- Leading `>`, `@`, `#`, and `!` queries provide real category-scope filtering for action, AI, object, and confirmation-required command sets without disabling `cmdk` keyboard filtering.
- URI input is resolved through `window.devhub.r8.command.resolveUri`.
- Scanner-backed object relationship commands open the global topology surface focused on a concrete process, port, or window node instead of routing through a monitor tab first.
- Topology commands include Chinese, pinyin, and English discovery keywords such as `拓扑`, `关系`, `tuopu`, `guanxi`, `流程图`, and `liucheng`.
- `command:resolve-uri` has an executable main IPC handler.
- R8 drawer commands open top, bottom, and statusbar drawers.
- `popout.port` creates a real BrowserWindow popout through the runtime service, and `popout <port>` queries invoke that backend command before using the renderer fallback path.
- `command:register-os-protocol` registers/unregisters `devhub://` through Electron's real protocol APIs and the Settings advanced panel exposes the user action.
- Command history list/clear remains on the existing runtime path and is now visible in the palette when persisted rows exist.
- `command:list` reaches 100+ default entries from real scanner-backed process, port, and window object commands without placeholder rows.
- `process.batch.tag` opens the monitor process surface and requests the existing batch-tag dialog instead of fabricating tag writes in the command layer.
- Settings Advanced exposes a custom-command manager backed by `command:list-custom` and `command:save-custom`.
- A real packaged Electron Playwright E2E opens the palette through `Ctrl+K`, verifies recent history and the five required groups, exercises `@/#/!` scope filters, resolves a `devhub://process/...` URI through the public preload bridge, invokes `settings.open`, verifies the real `SettingsDialog`, saves `custom.e2e.open-dashboard` through the custom-command UI, checks `command.listCustom()`, and disables the fixed E2E command in cleanup.
- The same E2E covers external OS-protocol handoff by registering `devhub://` when needed, calling `shell.openExternal()` with a scanner-backed URI, observing the single-instance `protocol-open` event in the renderer, and unregistering only if the test created the registration.

Intentionally unsupported in R8:

- Arbitrary shell, JavaScript, SKILL, or eval-like custom command execution. Safe custom commands remain limited to `command:<id>` and `devhub://...` handler forms.
