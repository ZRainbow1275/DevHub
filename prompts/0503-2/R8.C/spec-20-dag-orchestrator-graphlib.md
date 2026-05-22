# R8.C spec-20 — DAG 编排（graphlib 拓扑排序 + 循环检测 + 路径规划）

> **batch**: R8.C  |  **priority_in_batch**: #20（任务依赖核心算法）  |  **flag**: `R8.C.dag.orchestrator`
> **depends_on**: spec-13（CSV schema 提供 dependency 字段）+ spec-15（task queue 消费拓扑顺序）+ spec-33（Zod SoT）
> **blocks**: spec-21（可视化编辑器）+ spec-12（CSV driver 用 DAG 调度）
> **decision_anchor**: V1-Q-7.H.1 答 B（拓扑排序）/ V1-Q-7.H.2 答 C（混合：dependency + parallel_group + 优先级）/ V1-Q-10.D.2 答 A（graphlib）/ V1-Q-16.A.8 dependency DSL（after / if=success / any）
> **estimated_loc**: 1200
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_7_h_1: "B — 拓扑排序"
user_quote_v1_q_7_h_2: "C — 混合：dependency + parallel_group + priority"
user_quote_v1_q_10_d_2: "A — graphlib"
user_quote_v1_q_16_a_8: "C — 'after:task-001' / 'after:task-001 if=success' / 'after:task-001|task-002 if=any'"

goals:
  - 用 graphlib 把 CSV 任务列表构建为 DAG（节点=task，边=after dependency）
  - dependency DSL 解析：'after:T1' / 'after:T1 if=success' / 'after:T1|T2 if=any' / 'after:T1 if=failure'
  - 拓扑排序输出层级（layer 0/1/2/...），同层任务可并发
  - 循环检测：Tarjan 算法找强连通分量；任何 SCC size>1 即环
  - 综合排序：层级 → parallel_group → priority(0-100)
  - 提供 visit() API 给 spec-15 task queue 按层级 dispatch
  - 增量重算：任务失败 + on_fail=fallback-tool 改 tool 时不需要重排，仅当 dependency 改变才重排
  - DAG 健康检查：孤立节点（无入边无出边）、不可达节点、关键路径长度
  - 可视化导出：graphviz dot / mermaid flowchart / cytoscape json
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/dag/DagOrchestrator.ts
  - devhub/src/main/services/dag/DependencyDslParser.ts  # after:T1 if=success
  - devhub/src/main/services/dag/CycleDetector.ts  # Tarjan SCC
  - devhub/src/main/services/dag/TopoSorter.ts  # graphlib.alg.topsort + layering
  - devhub/src/main/services/dag/PriorityRanker.ts  # 同层内排序
  - devhub/src/main/services/dag/CriticalPathAnalyzer.ts  # CPM 估算总时长
  - devhub/src/main/services/dag/DagSerializer.ts  # 导出 dot / mermaid / cytoscape
  - devhub/src/main/services/dag/DagOrchestrator.test.ts
  - devhub/src/shared/schemas/dag.ts
modified_files:
  - devhub/src/main/services/task-queue/TaskScheduler.ts  # 调用 DagOrchestrator.layer()
  - devhub/src/main/ipc/csvHandlers.ts  # csv:dag-preview / dag:export
glob_anchors:
  - devhub/src/shared/schemas/csv-task-row.ts  # spec-13
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const DependencyConditionSchema = z.enum(['success', 'failure', 'any', 'completed'])
// completed = success or failure；any = 任一前置满足条件即可

export const DependencyClauseSchema = z.object({
  refs: z.array(z.string()).min(1),  // ['T1','T2']
  combinator: z.enum(['all', 'any']).default('all'),
  condition: DependencyConditionSchema.default('success'),
})

export const ParsedDependencySchema = z.object({
  raw: z.string(),
  clauses: z.array(DependencyClauseSchema),
})

export const DagNodeSchema = z.object({
  taskId: z.string(),
  layer: z.number().int().nonnegative(),  // 0 = 入度为 0
  parallelGroup: z.string().nullable(),
  parallelGroupMax: z.number().int().nullable(),
  priority: z.number().int().min(0).max(100).default(50),
  estimatedDurationMs: z.number().int().nullable(),
  isCriticalPath: z.boolean().default(false),
  inDegree: z.number().int().nonnegative(),
  outDegree: z.number().int().nonnegative(),
})

export const DagEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  condition: DependencyConditionSchema,
})

export const DagSnapshotSchema = z.object({
  sessionId: z.string().uuid(),
  generatedAt: z.number().int(),
  nodes: z.array(DagNodeSchema),
  edges: z.array(DagEdgeSchema),
  layers: z.array(z.array(z.string())),  // [[T1], [T2,T3], [T4]]
  totalLayers: z.number().int(),
  criticalPath: z.array(z.string()),
  estimatedTotalMs: z.number().int().nullable(),
  warnings: z.array(z.object({
  kind: z.enum(['orphan-node', 'unreachable', 'long-critical-path', 'parallel-group-conflict']),
  taskIds: z.array(z.string()),
  message: z.string(),
  })),
})
export type DagSnapshot = z.infer<typeof DagSnapshotSchema>

export const DagCycleErrorSchema = z.object({
  cyclePaths: z.array(z.array(z.string())),  // [['A','B','A']]
})

export interface IDagOrchestrator {
  build(rows: CsvTaskRow[], sessionId: string): Promise<DagSnapshot>
  detectCycle(rows: CsvTaskRow[]): Promise<DagCycleError | null>
  layer(snapshot: DagSnapshot, layerIndex: number): Promise<string[]>
  serialize(snapshot: DagSnapshot, format: 'dot' | 'mermaid' | 'cytoscape'): string
  isReady(snapshot: DagSnapshot, taskId: string, completedTaskIds: Set<string>, failedTaskIds: Set<string>): boolean
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  dag:build:
  rate_limit: medium_query
  req: { sessionId: string, csvPath: string }
  resp: DagSnapshot
  dag:detect-cycle:
  rate_limit: medium_query
  req: { csvPath: string }
  resp: { hasCycle: boolean, cycles?: string[][] }
  dag:export:
  rate_limit: meta
  req: { sessionId: string, format: 'dot'|'mermaid'|'cytoscape' }
  resp: { content: string, mimeType: string }
  dag:layer:
  rate_limit: medium_query
  req: { sessionId: string, layerIndex: number }
  resp: { taskIds: string[] }
  dag:check-ready:
  rate_limit: high_freq_scan
  req: { sessionId: string, taskId: string }
  resp: { ready: boolean, blockers?: string[] }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 检测到环 | E_DAG_CYCLE |
| dependency DSL 解析失败 | E_VALIDATION |
| 引用不存在的 taskId | E_NOT_FOUND |
| 节点数 > 1000 | E_VALIDATION（性能保护） |
| 关键路径过长（> 100 节点） | E_VALIDATION（warn） |
| sessionId 不存在 | E_NOT_FOUND |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础拓扑分层):
  given: 5 行任务 A→B,C; B,C→D; A,D→E
  when: DagOrchestrator.build
  then:
  - layers === [['A'], ['B','C'], ['D'], ['E']]
  - nodes[A].inDegree===0, nodes[A].outDegree===3
  - 无 warnings

GWT-2 (循环检测 Tarjan):
  given: A→B, B→C, C→A
  when: DagOrchestrator.detectCycle
  then:
  - hasCycle === true
  - cycles 至少含 ['A','B','C','A']

GWT-3 (条件依赖 if=any):
  given: T3 dependency='after:T1|T2 if=any'
  when: T1 succeeded T2 still running
  then: isReady(T3, completed={T1}, failed={}) === true

GWT-4 (条件依赖 if=failure):
  given: T3 dependency='after:T1 if=failure'
  when: T1 succeeded
  then:
  - isReady(T3, completed={T1}) === false
  - 通过 spec-15 task layer 自动 skipped（条件不满足）

GWT-5 (parallel_group max 反映在 snapshot):
  given: 3 任务全 parallel_group='frontend:max=2'
  when: build
  then:
  - 各节点 parallelGroupMax === 2
  - warnings 含 'parallel-group-conflict' 当 max=1 但 group 内同层 ≥ 2 任务

GWT-6 (critical path):
  given: 任务带 estimatedDurationMs，DAG: A(10)→B(20)→D(15); A→C(5)→D
  when: CriticalPathAnalyzer
  then:
  - criticalPath === ['A','B','D']
  - estimatedTotalMs === 45

GWT-7 (孤立节点警告):
  given: 5 任务，T5 无前置无后续
  when: build
  then: warnings 含 {kind:'orphan-node', taskIds:['T5']}

GWT-8 (导出 mermaid):
  given: 上述 5 任务
  when: serialize(format='mermaid')
  then:
  - 包含 'graph TD'
  - 包含 'A --> B'
  - 在 mermaid live editor 可渲染

GWT-9 (节点数超限):
  given: 1500 任务
  when: build
  then: E_VALIDATION + 提示拆分批次
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-20-dag.spec.ts
test('GWT-1 5-node basic layering', async ({ page }) => {
  const snap = await page.evaluate(() => window.electronAPI.dag.build({
  sessionId: '00000000-0000-0000-0000-000000000001',
  csvPath: './fixtures/dag-5-nodes.csv',
  }))
  expect(snap.layers).toEqual([['A'], ['B','C'], ['D'], ['E']])
})

test('GWT-2 cycle detection', async ({ page }) => {
  const r = await page.evaluate(() => window.electronAPI.dag.detectCycle({ csvPath: './fixtures/cycle-3.csv' }))
  expect(r.hasCycle).toBe(true)
  expect(r.cycles!.length).toBeGreaterThan(0)
})

test('GWT-8 export mermaid', async ({ page }) => {
  await page.evaluate(() => window.electronAPI.dag.build({ sessionId: 'sid', csvPath: './fixtures/dag-5.csv' }))
  const r = await page.evaluate(() => window.electronAPI.dag.export({ sessionId: 'sid', format: 'mermaid' }))
  expect(r.content).toMatch(/^graph TD/m)
  expect(r.content).toMatch(/A --> B/)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'graphlib@2.1':  DAG 构建 + topsort
  - '@dagrejs/graphlib@2.2':  graphlib 维护版（备用）
  - 'tarjan-graph@x':  独立 Tarjan SCC 实现
  - 'pegjs@0.x':  dependency DSL parser（如需复杂语法）
  - 'mermaid@10.x':  导出/校验 mermaid 字符串
inspirations:
  - "GitHub Actions needs:"
  - "GitLab CI needs:"
  - "Apache Airflow DAG"
  - "Make / Bazel 构建图"
dependency_dsl_grammar: |
  dependency := 'after:' ref_list (' if=' condition)?
  ref_list := id ('|' id)*  # | = any, no | or ',' = all
  condition := 'success' | 'failure' | 'any' | 'completed'
  默认 condition = 'success'
critical_path_method: |
  forward pass: ES (earliest start) = max(ES_pred + duration_pred)
  backward pass: LF (latest finish) = min(LF_succ - duration_succ)
  slack = LF - ES
  critical = nodes with slack === 0
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~700
modified_loc: ~80
test_loc: ~420
total: ~1200
risk_areas:
  - 1000+ 节点的 topo + critical path 性能
  - dependency DSL 错误信息友好度（让用户能定位 CSV 行号）
  - layer 算法选择（Kahn vs DFS）影响同层顺序稳定性
  - 增量更新（仅 dependency 变化才重算）的判定
```

---

## 10. implement_checklist

- [x] DependencyDslParser 解析 'after:T1 if=success' / 'after:T1|T2 if=any' / 'after:T1,T2'（默认 all）
- [x] graphlib.Graph 双向（forward + reverse）维护两份索引 — 2026-05-15 `DagBuildArtifacts` 增加 `forwardEdgesByTaskId` / `reverseEdgesByTaskId`，`TopoSorter` 与 `CriticalPathAnalyzer` 均消费该索引，回归测试断言 A→B/C 和 D←B/C 索引。
- [x] CycleDetector：先 graphlib.alg.findCycles → 任何 cycle 即报错；同时 Tarjan SCC 找完整 cycle paths
- [x] TopoSorter：BFS Kahn 算法 + layer 标号（同层内入度按 priority 降序、parallelGroup 名升序）— 2026-05-15 `TopoSorter.layer()` 使用 in-degree Kahn 分层，`PriorityRanker` 保持 parallelGroup 相邻与 priority 排序，`DagOrchestrator.test.ts` 覆盖 deterministic topo layers。
- [x] PriorityRanker：同层 priority 高优先；parallel_group 集中相邻
- [x] CriticalPathAnalyzer：用 estimatedDurationMs 做 forward/backward pass — 2026-05-15 `CriticalPathAnalyzer` 增加 earliest/latest/slack timings；`DagOrchestrator.test.ts` 覆盖 forward finish、backward latest、非关键分支 slack 和 critical flags。
- [x] DagSerializer：mermaid（graph TD + 节点 priority/parallel_group 标签）/ dot / cytoscape json
- [x] isReady() 综合判断：所有依赖 clauses 满足
- [x] feature flag `R8.C.dag.orchestrator` 默认 ON
- [x] 性能：1000 节点 build < 200ms；topo < 80ms；cycle detect < 50ms — 2026-05-15 `DagOrchestrator.buildWithMetrics()` exposes real phase timings and `DagOrchestrator.test.ts` asserts the 1000-node build/topo/cycle budgets against a deterministic 1000-node fanout fixture.
- [x] vitest fixture: dag-5/dag-100/cycle-3/orphan/parallel-group-conflict — 2026-05-15 named fixtures were consolidated in `DagOrchestrator.test.ts` and exercised in the focused DAG fixture regression.
- [x] 每次 build 写一份 snapshot 到 audit log（hash 作 key 增量）— 2026-05-15 `DagAuditEntry` is now a shared Zod contract, `R8RuntimeService.persistDagSnapshot()` appends sequence/previousHash audit rows, and `listDagAudit()` verifies repeated real CSV builds append incremental rows.

---

## 11. dependencies

```yaml
upstream:
  - spec-13: CsvTaskRow.dependency / parallel_group / priority 字段
  - spec-33: Zod SoT
downstream:
  - spec-15: task queue 通过 layer/isReady 调度
  - spec-21: 可视化编辑器读 DagSnapshot 渲染
  - spec-12: CSV driver 顶层使用 DagOrchestrator
  - spec-32: 观测面板显示 critical path
```

---

## 12. fallback_strategy

```yaml
on_dsl_parse_fail:
  - 提示具体 CSV 行号 + 建议
  - 整批拒绝启动 → spec-12 退回错误 banner
on_cycle_detected:
  - 高亮 cycle 路径返回给 spec-21 编辑器（用户视化定位）
  - audit log 记录环
on_perf_degradation:
  - 节点数 > 500 时改用 graphlib 增量 API
  - 节点数 > 1000 时拒绝 + 建议拆分
flag_off_behavior:
  - R8.C.dag.orchestrator=OFF → spec-15 退化到串行执行（按 CSV 行顺序）+ 通知用户禁用
```

---

## 13. performance_budget

```yaml
build_p95_ms_per_100_nodes: 30
topo_sort_p95_ms_per_500_nodes: 80
cycle_detect_p95_ms_per_500_nodes: 50
critical_path_p95_ms_per_500_nodes: 100
isReady_p99_ms: 5
serialize_mermaid_p95_ms: 30
node_max: 1000
edge_max: 5000
layer_max: 100
ipc_channel: dag:build → spec-31 medium_query 60 RPM
ipc_channel: dag:check-ready → spec-31 high_freq_scan 30 RPM
```

---

## 14. implementation_status_2026_05_11_dag_orchestrator_sync

```yaml
status: dag_orchestrator_partial_verified
implemented:
  - DagOrchestrator builds Zod-validated snapshots from CSV rows, runtime rows, graph input, or normalized input nodes.
  - DependencyDslParser covers comma dependencies plus after: refs with success, failure, any, and completed conditions.
  - CycleDetector combines graphlib cycle detection with Tarjan-style strongly connected component paths and build() rejects cyclic graphs with E_DAG_CYCLE.
  - PriorityRanker and TopoSorter produce deterministic layer snapshots with parallel groups kept adjacent and priority applied within groups.
  - DagSerializer exports Mermaid, DOT, and Cytoscape JSON from the same DagSnapshot contract.
  - isReady() evaluates dependency clauses against completed and failed terminal task sets, including completed as success-or-failure terminal state.
  - isReady() now rejects unknown task IDs as not-ready instead of treating absent nodes with no incoming edges as runnable.
  - R8RuntimeService exposes dag:build, dag:detect-cycle, dag:export, dag:layer, and dag:check-ready through the existing rate-limited IPC handler layer.
  - Feature-flag coverage verifies R8.C.dag.orchestrator default ON.
  - Added docs/r8/dag-orchestrator.md to document verified behavior and remaining boundaries.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/dag/DagOrchestrator.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 passed: 2 files / 11 tests.
  - pnpm -C devhub exec vitest run src/main/services/dag/DagOrchestrator.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "dag|Dag|DAG|default disabled states|feature flag|preload|IPC|schema" passed: 6 files / 31 tests, 96 skipped by filter.
known_boundaries:
  - TaskQueueService still keeps its own graphlib scheduling path; direct replacement with DagOrchestrator.layer() remains open.
  - Build-time audit log snapshot rows, dag-100 benchmark fixture evidence, full performance budgets, and packaged E2E remain outside this slice.
```

## 15. implementation_status_2026_05_15_topo_and_slack_pass

```yaml
status: partial_verified_topo_kahn_and_critical_slack
implemented:
  - TopoSorter.layer() already uses in-degree Kahn processing and deterministic layer labels; current focused tests reverified the contract.
  - DagBuildArtifacts now carries explicit forwardEdgesByTaskId and reverseEdgesByTaskId maps in addition to the graphlib.Graph object.
  - CriticalPathAnalyzer now performs a forward pass for earliest start/finish and a backward pass for latest start/finish.
  - CriticalPathResult now exposes per-task duration, earliestStartMs, earliestFinishMs, latestStartMs, latestFinishMs, slackMs, and isCritical for internal runtime consumers.
  - DagOrchestrator keeps the public DagSnapshot contract stable while using the richer internal timings to mark critical-path nodes.
verified_by:
  - npx gitnexus impact DagOrchestrator --repo devhub --direction upstream --depth 2 --include-tests: LOW risk, 6 impacted symbols, 0 affected processes.
  - npx gitnexus impact CriticalPathAnalyzer --repo devhub --direction upstream --depth 2 --include-tests: LOW risk, 5 impacted symbols, 0 affected processes.
  - pnpm -C devhub test --run src/main/services/dag/DagOrchestrator.test.ts -t "critical|slack|topo|cycle|parallel|orphan" --maxWorkers=1: 6 passed / 3 skipped by filter.
  - pnpm -C devhub test --run src/main/services/dag/DagOrchestrator.test.ts --maxWorkers=1: 9 passed.
  - pnpm -C devhub exec eslint src/main/services/dag/CriticalPathAnalyzer.ts src/main/services/dag/DagOrchestrator.test.ts: passed.
  - pnpm -C devhub exec tsc --noEmit --pretty false: passed.
known_boundaries:
  - Superseded by section 16 for 1000-node performance, dag-100 fixture, and build-time audit snapshot rows.
  - Direct TaskQueueService replacement, visual editor integration, and packaged E2E remain open.
```

## 16. implementation_status_2026_05_15_perf_fixtures_audit

```yaml
status: partial_verified_perf_fixtures_and_audit_rows
implemented:
  - DagOrchestrator.buildWithMetrics() now returns real phase timings for artifact build, cycle detection, Kahn topo sort, critical-path analysis, warning construction, snapshot finalization, and total build time without changing the public build() contract.
  - DagOrchestrator.test.ts now owns named vitest fixtures for dag-5, dag-100, cycle-3, orphan, and parallel-group-conflict, plus a deterministic 1000-node fanout fixture.
  - The 1000-node fixture asserts total build < 200ms, topo sort < 80ms, and standalone cycle detection < 50ms inside the focused Vitest run.
  - Shared dagAuditEntrySchema records dag:build rows with sessionId, hash, previousHash, sequence, generatedAt, node/edge/warning/layer counts, and criticalPathLength.
  - R8RuntimeService persists one DagAuditEntry for every buildDag() call, migrates older local dagAudit rows defensively, and exposes listDagAudit() for runtime evidence.
  - R8RuntimeService.test.ts builds from a real CSV path twice under a unique session ID and verifies the appended audit sequence and previousHash linkage before layer/export/check-ready assertions.
verified_by:
  - pnpm -C devhub test --run src/main/services/dag/DagOrchestrator.test.ts --maxWorkers=1: 10 passed.
  - pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "builds, stores, layers, exports, and checks a DAG" --maxWorkers=1: 1 passed / 96 skipped.
  - pnpm -C devhub exec eslint src/shared/schemas/dag.ts src/shared/schemas/r8-runtime.ts src/main/services/dag/DagOrchestrator.ts src/main/services/dag/DagOrchestrator.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts: passed.
  - pnpm -C devhub test --run src/main/services/dag/DagOrchestrator.test.ts src/main/services/R8RuntimeService.test.ts -t "DAG|Dag|builds, stores, layers" --maxWorkers=1: 13 passed / 94 skipped.
  - pnpm -C devhub exec tsc --noEmit --pretty false: passed.
known_boundaries:
  - Direct TaskQueueService replacement with DagOrchestrator.layer() remains open.
  - Visual editor integration belongs to spec-21 and remains outside this spec-20 slice.
  - Packaged Electron E2E remains open.
```

## 17. implementation_status_2026_05_15_task_queue_and_packaged_e2e_closure

```yaml
status: verified
implemented:
  - StoreBackedTaskQueueService now owns one DagOrchestrator instance and no longer imports or maintains its own graphlib dependency graph.
  - enqueueRows() persists rows in DagOrchestrator layer order, preserving deterministic topological scheduling without a parallel scheduler implementation.
  - waiting-dependency promotion now evaluates DagOrchestrator.isReady() against succeeded/skipped completed task IDs and failed/cancelled failed task IDs.
  - queue readiness supports the same dependency conditions as spec-20 DAG snapshots, including after:A if=failure, after:A if=success, and after:B|C if=completed.
  - packaged Electron Playwright E2E exercises dag:build, dag:layer, dag:export, dag:check-ready, and dag:detect-cycle through the real preload IPC bridge.
  - visual editor integration remains assigned to R8.C spec-21 and is not a spec-20 open boundary.
verified_by:
  - pnpm -C devhub test --run src/main/services/task-queue/TaskQueueService.test.ts src/main/services/dag/DagOrchestrator.test.ts --maxWorkers=1: 2 files passed, 20 tests passed.
  - pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "schedules CSV groups|builds, stores, layers" --maxWorkers=1: 1 file passed, 2 tests passed.
  - pnpm -C devhub exec eslint src/main/services/task-queue/TaskQueueService.ts src/main/services/task-queue/TaskQueueService.test.ts e2e/example.spec.ts: passed.
  - pnpm -C devhub exec tsc --noEmit --pretty false: passed.
  - pnpm -C devhub build: passed; existing Monaco dynamic/static import warning remains non-fatal.
  - pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-20" --workers=1 --reporter=line: 1 test passed.
known_boundaries:
  - None for R8.C spec-20. R8.C spec-21 owns the separate visual editor.
```
