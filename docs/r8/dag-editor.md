# R8.C DAG Editor

## Scope

`DagEditorPanel` is the current renderer slice for editing CSV-backed DAG task plans. It uses a top-level Zustand `EditorState` store, the shared R8 runtime bridge, and the existing DAG orchestrator to keep CSV rows, graph previews, list edits, Gantt-style layers, and Kanban status columns aligned.

This document covers the verified panel, shared editor store, CSV two-way sync helpers, Immer patch history, built-in five-template palette, 18-column node detail editor, external mtime watch modal, keyboard-accessible canvas navigation, packaged Electron Playwright fixture, and runtime CSV lock/save/template slice.

## Verified Contracts

- Opening a CSV path calls `csv.lock` with a real path and displays lock ownership, row count, cycle count, and file mtime.
- `useDagEditorStore` maintains the top-level `DagEditorState` source of truth for rows, view, selected nodes, lock state, dirty state, DAG snapshot, cycle paths, and undo/redo patch stacks.
- Dragging one canvas task onto another updates the target row dependency through `dag-editor-sync.ts` and triggers DAG re-evaluation.
- List view edits share the same Zustand-backed row state as canvas, Gantt, and Kanban views.
- Cycle detection disables save and displays returned cycle paths.
- Undo and redo use `immer` `produceWithPatches` / `applyPatches`, keep a bounded 50-entry history, and compact adjacent edits for the same task field.
- Built-in templates are served from `R8RuntimeService.listCsvTemplates()` when `source=builtin` and include code review, write tests, fix bug, commit, and PR description quick picks.
- `NodeDetailPanel` renders all 18 shared CSV columns from `CSV_COLUMN_INFO`, applies enum and numeric field controls, validates rows through `csvTaskRow18Schema.safeParse()`, and disables save through `DagEditorState.validationErrors` when any field is invalid.
- Saving calls the runtime CSV save path, which validates every row with the shared 18-column schema, checks file ownership, rejects cycles, enforces mtime conflict detection, and writes through a temporary file rename.
- Successful editor locks start a dedicated chokidar-backed `CsvFileWatcher` for the locked CSV path, compare observed mtime against the editor's last saved mtime, and stream real external file changes through `csv:external-change-stream`.
- External changes open a three-action modal: reload the external version, overwrite-save the local version, or keep editing while preserving the later save-time mtime guard.
- `DagCanvas` exposes a roving-tabindex listbox over the Cytoscape surface; arrow keys, Home, End, Enter, and Space select real graph nodes through the same `onNodeClick` callback and announce the active node through an `aria-live` region.
- The packaged Electron Playwright fixture writes a real temporary CSV, opens Monitor -> R8 Operations, locks and loads the CSV through the public preload bridge, edits List view dependencies, verifies Canvas/Gantt/Kanban synchronization, exercises Undo, blocks cycle saves, and triggers the external modify modal through a real filesystem write.
- Packaged-runtime SQLite native ABI mismatch no longer aborts all extended R8 IPC registration: first-time inject confirmation and inject audit SQLite paths degrade gracefully while preserving the real CSV/DAG handlers.
- Template save and insert reuse real `csv.saveTemplate` results and materialize new CSV rows locally.
- Runtime audit rows cover editor open, editor close, save success/refusal, cycle-attempt refusal, and lock-conflict refusal without storing CSV row contents.
- `R8.C.dag.editor` is enabled by default.

## Runtime Integration

The renderer uses these runtime bridge calls:

- `csv.lock`
- `csv.unlock`
- `csv.save`
- `csv.listTemplates`
- `csv.saveTemplate`
- `csv.onLockStatus`
- `csv.onExternalChange`
- `dag.detectCycle`
- `dag.build`

The renderer state/sync modules are:

- `src/renderer/stores/dagEditorStore.ts`
- `src/renderer/components/dag-editor/dag-editor-sync.ts`
- `src/renderer/components/dag-editor/dag-editor-history.ts`
- `src/renderer/components/dag-editor/TemplateNodePalette.tsx`
- `src/renderer/components/dag-editor/NodeDetailPanel.tsx`

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "dag editor|TemplateNodePalette|stores and deletes real CSV node templates|locks a real CSV path|builtin"
pnpm -C devhub exec vitest run src/renderer/components/dag-editor/NodeDetailPanel.test.tsx src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "NodeDetailPanel|dag editor|TemplateNodePalette|stores and deletes real CSV node templates|locks a real CSV path|builtin|validates NodeDetailPanel"
pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/components/dag-editor/NodeDetailPanel.test.tsx src/renderer/components/dag-editor/dag-editor-history.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "external modify|external mtime|locks, saves, rejects cyclic CSV writes|DagEditorPanel|NodeDetailPanel|dag editor|TemplateNodePalette|routes CSV lock"
pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagCanvas.test.tsx src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1 -t "DagCanvas a11y|DagEditorPanel"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "locks, saves|stores and deletes"
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "locks, saves, rejects cyclic CSV writes"
pnpm -C devhub exec vitest run src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub build
pnpm -C devhub test:e2e --grep "R8.C spec-21" --reporter=line --workers=1
pnpm -C devhub typecheck
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/dag-editor/DagEditorPanel.tsx src/renderer/components/dag-editor/TemplateNodePalette.tsx src/renderer/components/dag-editor/NodeDetailPanel.tsx src/renderer/components/dag-editor/NodeDetailPanel.test.tsx src/renderer/components/dag-editor/dag-editor-sync.ts src/renderer/components/dag-editor/dag-editor-history.ts src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/stores/dagEditorStore.ts src/shared/schemas/dag-editor-state.ts
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
```

## Open Boundaries

- Cytoscape canvas and edge-context-menu interactions remain open.
- Cytoscape edge deletion UI remains open even though `dag-editor-sync.ts` supports add and remove row mutations.
- Built-in five-template palette and the full 18-column detail panel are verified through focused renderer tests and shared-schema validation.
