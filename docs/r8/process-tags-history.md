# R8.B spec-14 Process Tags and 24h History

## Implementation Status

This slice implements the real local persistence path for process tags and 24h process history without mock data.

- Source spec: `prompts/0503-2/R8.B/spec-14-process-tags-history.md`
- Feature flag: `R8.B.process.tags-history`
- Status: verified for the spec-14 checklist and current render budget; broader R8.B remains partial while other specs retain open items
- Storage: `electron-store` for tags, `better-sqlite3` for process history with in-memory fallback only when SQLite cannot open
- Identity: normalized `(exe, cwd)` pair, hashed with SHA-256 in the main process

## Data Contracts

- `ProcessTag` is defined in `src/shared/schemas/r8-runtime.ts`.
- `ProcessHistory` is defined in `src/shared/schemas/r8-runtime.ts`.
- `TAG_HISTORY_LIMITS` is shared from `src/shared/process-tags-history.ts`.
- Tag text is trimmed, whitespace-normalized, and capped at 64 characters.
- History samples store `cpu`, `rssMb`, optional `handles`, optional `threads`, and `missing`.

## Main Process

- `src/main/services/ProcessTagStore.ts`
  - Persists tags in `devhub-process-tags`.
  - Uses `(exe, cwd)` identity, not PID.
  - Supports list, get, set, remove, JSON export, and JSON import.

- `src/main/services/ProcessHistoryStore.ts`
  - Persists history to `process-history.sqlite3` under Electron `userData`.
  - Creates `process_history` table and timestamp index.
  - Keeps seven-day retention through cleanup.
  - Inserts gap markers during query when clock gaps are detected, without fabricating metric values.

- `src/main/services/ProcessHistorySampler.ts`
  - Samples at most once per minute per `(exe, cwd)` key.
  - Records real values from `SystemProcessScanner.scan()`.
  - Cleans old history hourly.

- `src/main/services/SystemProcessScanner.ts`
  - Calls the sampler after a real scan produces `ProcessInfo`.
  - Keeps the existing PID-local short history for existing card sparklines.
  - Adds `getProcessHistory24h()` and `getProcessHistoryBatch()`.

## IPC and Preload

The following IPC channels are registered in `src/main/ipc/processHandlers.ts` and exposed through `window.devhub.systemProcess`:

- `process:tags-list`
- `process:tags-set`
- `process:tags-remove`
- `process:tags-export`
- `process:tags-import`
- `process:history-24h`
- `process:history-batch`

## Renderer

- `src/renderer/hooks/useProcessTag.ts`
  - Loads and caches process tags.
  - Maps tags back to process rows by normalized `(exe, cwd)`.

- `src/renderer/hooks/useProcessHistory.ts`
  - Loads 24h history for visible processes.
  - Keeps history keyed by normalized process identity.

- `src/renderer/components/monitor/process/ProcessTagBadge.tsx`
  - Shows existing tags and empty add-label affordance.

- `src/renderer/components/monitor/process/ProcessTagEditor.tsx`
  - Allows tag text, color, and pinned state editing.

- `src/renderer/components/monitor/process/ProcessSparkline.tsx`
  - Renders SVG 24h CPU/RSS/handles/threads trends.
  - Draws dotted gap indicators for missing intervals.
  - Compacts 1440-point 24h histories into bounded render points by rendered width while preserving the latest metric value and missing-gap signaling.

- `src/renderer/components/monitor/ProcessView.tsx`
  - Shows tags and 24h CPU sparklines in list and card views.
  - Opens the tag editor from rows, cards, and context menus.
  - Applies batch tags to selected process identities through the same executable tag bridge used by single-process editing.

- `src/renderer/components/monitor/process/ProcessBatchTagDialog.tsx`
  - Collects batch tag label, color, and pinned state for selected processes.
  - Works with `ProcessView`'s 5-second undo snapshot to restore or remove tags through the real tag IPC bridge.

- `src/main/services/R8RuntimeService.ts`
  - Registers `process.batch.tag` in the R8 command palette as a real command entry.
  - Invoking the command navigates to the Process monitor and requests the same batch-tag dialog used by the toolbar.

- `src/renderer/components/monitor/ProcessDetailDrawer.tsx`
  - Loads 24h history through the same Zod-validated `useProcessHistory24h()` path used by list/card rows.
  - Shows a large resource-tab trend panel for CPU, RSS, handles, and threads.
  - Keeps the 60s PID-local CPU chart intact and adds the `(exe/name, cwd)` 24h identity without using PID as the persistence key.

- `src/renderer/components/monitor/process/ProcessTreeView.tsx`
  - Shows process tags in tree rows.

- `src/renderer/components/monitor/process/ProcessTreemapView.tsx`
  - Adds `colorBy=tag` selection.
  - Tints treemap tiles by tag color when a tag exists.

- `src/renderer/components/statusbar/StatusBarProcessHistoryWidget.tsx`
  - Adds the spec-08 linked independent statusbar mini-sparkline widget without changing the verified 12-tile statusbar aggregate contract.
  - Selects the current highest-CPU real process from `useProcessStore`.
  - Loads history through the same `useProcessHistory24h().loadHistory()` path and executable `process:history-24h` IPC bridge used by Process list/card/detail surfaces.
  - Navigates to the Process monitor with the selected process scope when clicked.

## Verified

- `pnpm -C devhub test --run src/main/services/ProcessTagStore.test.ts src/main/services/ProcessHistoryStore.test.ts --maxWorkers=1`
- `pnpm -C devhub test --run src/renderer/components/monitor/ProcessDetailDrawer.test.tsx --maxWorkers=1`
- `pnpm -C devhub test --run src/renderer/components/monitor/process/processBatchModel.test.ts src/renderer/components/monitor/process/ProcessBatchToolbar.test.tsx src/renderer/components/monitor/process/ProcessBatchTagDialog.test.tsx --maxWorkers=1`
- `pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "batch tag dialog|command palette"`
- `pnpm -C devhub test --run src/renderer/components/statusbar/StatusBar.test.tsx --maxWorkers=1`
- `pnpm -C devhub bench:sparkline`
- `pnpm -C devhub exec eslint src/renderer/components/monitor/process/ProcessSparkline.tsx src/renderer/components/monitor/ProcessDetailDrawer.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/ProcessDetailDrawer.test.tsx`
- `pnpm -C devhub typecheck`

## Remaining Boundary

- Spec-14 is closed for the current checklist and 100-sparkline DOM budget.
- Full R8.B remains partial because other R8.B specs still retain open ledger items.
