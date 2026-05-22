# R8.C DAG Orchestrator

## Scope

`DagOrchestrator` builds local DAG snapshots for CSV and graph inputs. It uses `@dagrejs/dagre` graphlib for graph storage and topological operations, validates all public snapshot shapes through shared Zod schemas, and exposes the same contract through `R8RuntimeService` and the `dag:*` IPC handlers.

This document covers the verified orchestration slice, direct task-queue scheduling reuse, and packaged Electron E2E coverage. Visual editor ownership belongs to R8.C spec-21 rather than this orchestrator contract.

## Verified Contracts

- `DependencyDslParser` supports plain comma dependencies, `after:T1`, `after:T1 if=success`, `after:T1,T2`, `after:T1|T2 if=any`, `after:T1 if=failure`, and `after:T1,T2 if=completed`.
- `CycleDetector` combines graphlib cycle detection with Tarjan-style strongly connected component paths and rejects runnable snapshots when a cycle exists.
- `DagBuildArtifacts` maintains explicit `forwardEdgesByTaskId` and `reverseEdgesByTaskId` maps alongside the `graphlib.Graph` object.
- `TopoSorter` performs in-degree based Kahn layering and returns deterministic layer labels.
- `PriorityRanker` keeps same-layer parallel groups adjacent, orders groups by name, then orders higher priority tasks first within each group.
- `CriticalPathAnalyzer` now performs both forward and backward passes over `estimatedDurationMs`, producing earliest/latest timings, slack, and critical flags before `DagOrchestrator` writes the public snapshot.
- `DagOrchestrator.buildWithMetrics()` returns real phase timings for artifact build, cycle detection, topo sort, critical-path analysis, warnings, snapshot finalization, and total build time while preserving the existing `build()` return contract.
- `DagSerializer` exports Mermaid, Graphviz DOT, and Cytoscape JSON from the typed snapshot.
- `isReady()` evaluates dependency clauses against completed and failed terminal task sets.
- `isReady()` returns not-ready for unknown task IDs instead of treating an absent node with no incoming edges as runnable.
- `R8.C.dag.orchestrator` is enabled by default.
- `DagAuditEntry` is a shared Zod contract and records one `dag:build` audit row per runtime build with `hash`, `previousHash`, `sequence`, node/edge/warning/layer counts, and critical path length.
- Named Vitest fixtures cover `dag-5`, `dag-100`, `cycle-3`, `orphan`, `parallel-group-conflict`, and a deterministic 1000-node fanout performance fixture.
- `StoreBackedTaskQueueService` now delegates topological ordering and dependency readiness to `DagOrchestrator` instead of maintaining a parallel graphlib scheduler.
- Task queue dependency readiness now honors DAG conditions such as `after:A if=failure`, `after:A if=success`, and `after:B|C if=completed`.
- The packaged Electron E2E exercises `dag:build`, `dag:layer`, `dag:export`, `dag:check-ready`, and `dag:detect-cycle` through the real preload IPC bridge.

## Runtime Integration

`R8RuntimeService` owns a `DagOrchestrator` instance and persists generated snapshots by session ID for:

- `dag:build`
- `dag:detect-cycle`
- `dag:export`
- `dag:layer`
- `dag:check-ready`

CSV launch dry-runs also build a DAG snapshot from real parsed rows before returning the dry-run session result.

Every `buildDag()` call appends an incremental `dagAudit` row in the local runtime store. Older local audit entries are migrated defensively at read time so stale pre-schema rows do not crash unrelated DAG operations.

The task queue no longer owns a second graphlib scheduling path. `enqueueRows()` sorts rows by `DagOrchestrator.build().layers`, and waiting dependency promotion evaluates `DagOrchestrator.isReady()` against succeeded/skipped and failed/cancelled terminal task sets.

## Verified Commands

```bash
pnpm -C devhub exec vitest run src/main/services/dag/DagOrchestrator.test.ts src/shared/feature-flags.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/main/services/dag/DagOrchestrator.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "dag|Dag|DAG|default disabled states|feature flag|preload|IPC|schema"
pnpm -C devhub test --run src/main/services/dag/DagOrchestrator.test.ts -t "critical|slack|topo|cycle|parallel|orphan" --maxWorkers=1
pnpm -C devhub test --run src/main/services/dag/DagOrchestrator.test.ts --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/dag/CriticalPathAnalyzer.ts src/main/services/dag/DagOrchestrator.test.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "builds, stores, layers, exports, and checks a DAG" --maxWorkers=1
pnpm -C devhub exec eslint src/shared/schemas/dag.ts src/shared/schemas/r8-runtime.ts src/main/services/dag/DagOrchestrator.ts src/main/services/dag/DagOrchestrator.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts
pnpm -C devhub test --run src/main/services/dag/DagOrchestrator.test.ts src/main/services/R8RuntimeService.test.ts -t "DAG|Dag|builds, stores, layers" --maxWorkers=1
pnpm -C devhub test --run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/dag/DagOrchestrator.test.ts --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/task-queue/TaskQueueService.ts src/main/services/task-queue/TaskQueueService.test.ts e2e/example.spec.ts
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-20" --workers=1 --reporter=line
```

## Open Boundaries

- Visual editor integration belongs to spec-21 and is not claimed here.
