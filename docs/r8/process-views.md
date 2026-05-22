# R8.B Process Tree and Treemap Views

## Scope

`prompts/0503-2/R8.B/spec-06-process-treemap-tree.md` is implemented as a verified slice. The existing list/card/grouped process surfaces remain intact. The slice adds Tree and Treemap views plus runtime IPC contracts for process hierarchy and RSS-proportional treemap data.

## Renderer

- `src/renderer/components/monitor/ProcessView.tsx` now supports persisted modes:
  - `list`
  - `card`
  - `grouped`
  - `tree`
  - `treemap`
- `src/renderer/components/monitor/process/ProcessTreeView.tsx` renders a virtualized tree row list.
- `src/renderer/stores/processStore.ts` maintains `processByPid` and `childPidsByParentPid` indexes for cross-view lookup and child expansion.
- `src/renderer/components/monitor/process/ProcessTreemapView.tsx` renders RSS-proportional SVG tiles through a bulk SVG DOM path with event delegation, bounded labels, and SVG escaping for dirty process names.
- `src/renderer/utils/treemapLayout.ts` builds tree nodes and a d3-hierarchy treemap from real process rows.

## Runtime IPC

Executable channels:

- `process:tree`
- `process:tree-children`
- `process:treemap-data`
- `process:view-mode-set`

The runtime reads current scanner cache process rows. It does not ship production mock process data.

## Lazy Tree Children

The tree renderer uses the store's parent/children index to decide whether a bounded tree node can expand further. When a parent has indexed children but the initial tree payload does not include them, expansion calls the real preload bridge `window.devhub.r8.processViews.treeChildren(pid)` and merges returned children into the local tree view state. Loading and failure states are shown inline in the existing CPU/AI column.

## Command Palette

`R8RuntimeService.listCommands()` includes:

- `process.view.tree`
- `process.view.treemap`

Invoking these commands emits `r8:command-event` with `type: process-view-mode`. The renderer opens the Monitor pane and applies the requested process view mode.

## Validation

Verified with low-resource commands from `D:/Desktop/CREATOR ONE`:

```bash
pnpm -C devhub test --run src/renderer/stores/processStore.test.ts src/renderer/components/monitor/process/ProcessTreeView.test.tsx src/renderer/utils/treemapLayout.test.ts --maxWorkers=1
pnpm -C devhub test --run src/renderer/components/monitor/process/ProcessTreemapView.test.tsx --maxWorkers=1
pnpm -C devhub test --run src/renderer/utils/treemapLayout.test.ts src/renderer/stores/processStore.test.ts src/renderer/components/monitor/process/ProcessTreeView.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "treemap|Tree|process tree|Process|processStore"
pnpm -C devhub test --run src/renderer/utils/treemapLayout.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "treemap|Tree|process tree|Process"
pnpm -C devhub bench:treemap
pnpm -C devhub typecheck
```

## Render Benchmark

`pnpm -C devhub bench:treemap` builds a production Vite bundle for the real `ProcessTreemapView`, runs it in headless Chromium, commits 500 RSS-proportional SVG tiles, and fails if the 12-sample DOM commit p95 is at or above 16ms. The benchmark does not add production mock data; it uses deterministic benchmark rows only inside the script while runtime IPC continues to read live scanner snapshots.

Latest local run on 2026-05-15:

```json
{
  "label": "BENCH-TREEMAP-500-DOM",
  "passed": true,
  "stats": {
    "p95": 7.5,
    "samples": 12
  },
  "tileCount": {
    "expected": 500,
    "min": 500,
    "max": 500
  }
}
```

## Completion Boundary

- Current R8.B spec-06 scope is verified: d3-hierarchy layout, real renderer Tree/Treemap surfaces, IPC/preload bridge, command palette switching, Electron E2E, and the 500-node DOM render benchmark are covered.
- Future Canvas fallback remains an emergency strategy only if a later regression exceeds the SVG render budget.
