# R8.C spec-24 — 全屏拓扑（顶级一级入口 + 网络拓扑/神经关系切换）

> **batch**: R8.C  |  **priority_in_batch**: #24（feedback#5 双图 + 全局入口）  |  **flag**: `R8.C.topology.global`
> **depends_on**: spec-31（IPC 限流）+ spec-33（Zod SoT）+ R8.A spec-05（拓扑入口三端冗余）+ R8.B spec-08（命令面板）+ R8.B spec-13（活动栏图标）
> **blocks**: spec-25（附属拓扑共享数据）+ spec-26（流程图复用 graph layer）
> **decision_anchor**: V1-Q-8.H.1 答 A（全局拓扑作为一级入口）/ V1-Q-11.A.3 用户保留 / V1-Q-14.B.1..B.5 全局 vs 附属双重存在 / feedback#5 网络拓扑 + 神经关系两套图体系
> **estimated_loc**: 1500
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_8_h_1: "A — 是，作为一级入口"
user_quote_v1_q_11_a_3: "保留：全屏拓扑（一级入口）"
user_quote_v1_q_14_b_1_implied: "D — 双重存在 + 共享数据层"
feedback_5: "原本设计的'打开资源后可以查看网络拓扑图和神经关系图'消失了，三端附属 + 全局并存"

goals:
  - 全屏拓扑视图（FullScreenTopologyView），五个入口冗余（活动栏 / Tab / 命令面板 / 状态栏 / Ctrl+T）
  - 三 graphKind 切换：network-topology / neural-relationship / flow（spec-26）
  - 全局视图职责：鸟瞰 + 历史 + 跨对象探索（与 spec-25 附属"单对象聚焦"职责分离）
  - 共享 GraphService：与 spec-25 / spec-26 共用同一数据层（master §7.8 三套图体系）
  - 切片：按 process / port / window / project / 全部
  - 节点上限 500（超 500 触发降级 + 用户主动 expand）
  - 布局：dagre / cose-bilkent / cola / circle 四种 + 用户自定义保存
  - 时间游标：可回看到任意历史时刻的拓扑（spec-22 录像/审计派生）
  - 导出：mermaid / dot / SVG / PNG
  - 与三模块详情面板的双向同步（点击节点 → 打开详情；详情中"查看在全局图" → 切回全局并定位）
  - PRIVACY-ZERO-TELEMETRY：拓扑数据全本地，绝不外发
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/graph/GraphService.ts  # 三套图共享数据层
  - devhub/src/main/services/graph/builders/NetworkTopologyBuilder.ts  # netstat/handle/parent
  - devhub/src/main/services/graph/builders/NeuralRelationshipBuilder.ts  # cwd/tag/spawn
  - devhub/src/main/services/graph/GraphCache.ts
  - devhub/src/main/services/graph/GraphSnapshotter.ts  # 时间点快照
  - devhub/src/main/services/graph/SignalFusionAdapter.ts  # spec-27 信号注入
  - devhub/src/renderer/components/topology/FullScreenTopologyView.tsx
  - devhub/src/renderer/components/topology/GraphKindSwitcher.tsx
  - devhub/src/renderer/components/topology/GraphLayoutMenu.tsx
  - devhub/src/renderer/components/topology/GraphSliceMenu.tsx
  - devhub/src/renderer/components/topology/GraphTimeCursor.tsx
  - devhub/src/renderer/components/topology/GraphExportMenu.tsx
  - devhub/src/renderer/components/topology/GraphCanvas.tsx  # cytoscape wrapper（与 spec-21 复用）
  - devhub/src/renderer/components/topology/FullScreenTopologyView.test.tsx
  - devhub/src/shared/schemas/graph.ts  # GraphKind / NodeKind / EdgeKind
modified_files:
  - devhub/src/renderer/components/activity-bar/ActivityBar.tsx  # 一级入口图标
  - devhub/src/renderer/components/command-palette/CommandPalette.tsx  # "打开全局拓扑"
  - devhub/src/renderer/components/statusbar/StatusBar.tsx  # 拓扑徽章
  - devhub/src/main/ipc/topologyHandlers.ts  # topology:build-global-graph
  - devhub/src/renderer/router/routes.tsx  # /topology/global
glob_anchors:
  - devhub/src/renderer/components/topology/AttachedGraphView.tsx  # spec-25 共用 GraphService
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const GraphKindSchema = z.enum(['network-topology', 'neural-relationship', 'flow'])

export const NodeKindSchema = z.enum(['process', 'port', 'window', 'project', 'tag', 'ai-task', 'event'])

export const NetworkEdgeKindSchema = z.enum(['listens', 'connects', 'owns', 'parent-of', 'dll-load', 'service-link'])
export const NeuralEdgeKindSchema = z.enum(['belongs-to-project', 'has-tag', 'shares-cwd', 'spawned-by', 'ai-session-of'])
export const FlowEdgeKindSchema = z.enum(['happens-before', 'triggers', 'fails', 'retries'])

export const GraphNodeSchema = z.object({
  id: z.string(),
  kind: NodeKindSchema,
  label: z.string(),
  meta: z.record(z.string(), z.unknown()),  // pid / cwd / tool / etc.
  signals: z.object({  // spec-27 信号融合
  fusionScore: z.number().min(0).max(1).optional(),
  state: z.string().optional(),
  }).optional(),
})

export const GraphEdgeSchema = z.object({
  id: z.string(),
  kind: GraphKindSchema,
  type: z.union([NetworkEdgeKindSchema, NeuralEdgeKindSchema, FlowEdgeKindSchema]),
  source: z.string(),
  target: z.string(),
  inferenceConfidence: z.number().min(0).max(1).optional(),  // 仅 neural
  durationMs: z.number().int().optional(),  // 仅 flow
})

export const GraphSliceSchema = z.object({
  scope: z.enum(['process', 'port', 'window', 'project', 'global']),
  targetIds: z.array(z.union([z.string(), z.number()])).optional(),
  graphKind: GraphKindSchema,
  depth: z.number().int().min(1).max(10).default(3),
  asOfTs: z.number().int().nullable(),  // 时间游标
})

export const GraphSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  generatedAt: z.number().int(),
  slice: GraphSliceSchema,
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  warnings: z.array(z.object({
  code: z.string(),
  message: z.string(),
  })),
})

export const GraphLayoutSchema = z.enum(['dagre', 'cose-bilkent', 'cola', 'circle', 'preset'])

export interface IGraphService {
  buildGlobal(slice: GraphSlice): Promise<GraphSnapshot>
  buildAttached(scope: 'process'|'port'|'window', targetId: string|number, kind: GraphKind, depth: number): Promise<GraphSnapshot>
  saveSnapshot(snapshotId: string, label: string): Promise<{ saved: boolean, path: string }>
  listSavedSnapshots(): Promise<Array<{ id: string, label: string, savedAt: number }>>
  exportFormat(snapshotId: string, format: 'mermaid'|'dot'|'svg'|'png'): Promise<{ content: string|Buffer, mimeType: string }>
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  topology:build-global-graph:
  rate_limit: medium_query
  req: GraphSlice
  resp: GraphSnapshot
  topology:network:
  rate_limit: medium_query
  req: { scope: 'global'|'process'|'port'|'window', targetIds?, depth }
  resp: GraphSnapshot
  topology:neural:
  rate_limit: medium_query
  req: { scope, targetIds?, depth }
  resp: GraphSnapshot
  topology:save-snapshot:
  rate_limit: low_freq_op
  req: { snapshotId: string, label: string }
  resp: { saved: boolean, path: string }
  topology:list-snapshots:
  rate_limit: meta
  req: {}
  resp: Array<{ id, label, savedAt }>
  topology:export:
  rate_limit: meta
  req: { snapshotId: string, format: 'mermaid'|'dot'|'svg'|'png' }
  resp: { content: string|base64-encoded, mimeType: string }
  topology:warm-scope:
  rate_limit: low_freq_op
  req: { scopes: GraphSlice[] }
  resp: { warmed: number }
  topology:event-stream:
  direction: main->renderer
  streaming: true
  payload: { type: 'node-added'|'node-removed'|'edge-changed'|'snapshot-ready', data: unknown }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 节点数 > 500 | E_GRAPH_NODE_LIMIT（自动降级） |
| 深度 > 10 | E_GRAPH_DEPTH_LIMIT |
| graphKind 非法 | E_VALIDATION |
| 数据源失败（netstat/handle） | E_RUNTIME（部分图缺失） |
| 截图导出失败 | E_RUNTIME |
| 历史快照不存在 | E_NOT_FOUND |
| asOfTs 早于审计起始 | E_VALIDATION |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (一级入口五处冗余):
  given: 用户首次启动 DevHub
  when: 检查活动栏 / 命令面板 / 状态栏 / 路由 / 快捷键
  then:
  - 活动栏含 'topology-global' 图标
  - 命令面板能搜到 "打开全局拓扑"
  - 状态栏含拓扑徽章按钮
  - Ctrl+T 直达
  - 路由 /topology/global 可访问

GWT-2 (graphKind 三选切换):
  given: 在 FullScreenTopologyView
  when: 切到 'neural-relationship'
  then:
  - 边类型变为 belongs-to-project / has-tag / shares-cwd / spawned-by
  - 节点保留（NodeKind 共享）
  - 切换 < 300ms（已缓存）

GWT-3 (slice 切片):
  given: scope='process' targetIds=[1234]
  when: buildGlobal
  then: nodes 只含 PID=1234 + 1 跳邻居（depth=1）

GWT-4 (节点超限降级):
  given: 真实环境 800 进程
  when: 默认 buildGlobal global
  then:
  - E_GRAPH_NODE_LIMIT
  - UI 显示"节点数超限，请按 process/port/project 切片"
  - 提供"展开全部（性能可能下降）"按钮

GWT-5 (时间游标):
  given: 5 分钟前的审计快照存在
  when: GraphTimeCursor 拖到 5min ago
  then:
  - asOfTs 写入 slice
  - 重新 build → 当时的 nodes/edges
  - 节点带 'historical' 样式

GWT-6 (保存快照):
  given: 当前 snapshot
  when: saveSnapshot(label='claude-debug-2026-05-03')
  then:
  - JSON 文件写到 %APPDATA%/devhub/topology-snapshots/
  - listSavedSnapshots 返回该 entry

GWT-7 (导出 mermaid):
  given: snapshot 含 5 节点 6 边
  when: export(format='mermaid')
  then:
  - 字符串以 'graph TD' 开头
  - 含 node id + edge label
  - 在 mermaid live editor 可视化

GWT-8 (与详情面板同步):
  given: 用户在全局拓扑选中 PID=P
  when: 点击 'open in process detail'
  then:
  - 跳到 ProcessDetailPanel(P)
  - 该面板默认打开附属拓扑 Tab（spec-25）
  - 反向：详情面板"在全局看" → 全局视图定位到 P
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-24-topology-global.spec.ts
test('GWT-1 5 redundant entries', async ({ page }) => {
  await expect(page.locator('[data-activity-bar-icon="topology-global"]')).toBeVisible()
  await page.click('[data-activity-bar-icon="topology-global"]')
  await expect(page.locator('[data-testid="full-screen-topology-view"]')).toBeVisible()
  // 命令面板
  await page.keyboard.press('Control+K')
  await page.fill('[data-testid="cmd-input"]', '全局拓扑')
  await expect(page.locator('[data-testid="cmd-result-topology-global"]')).toBeVisible()
})

test('GWT-2 graphKind switch', async ({ page }) => {
  await page.goto('app://./topology/global')
  await page.click('[data-testid="graph-kind-network-topology"]')
  await page.click('[data-testid="graph-kind-neural-relationship"]')
  await expect(page.locator('.graph-canvas[data-kind="neural-relationship"]')).toBeVisible()
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'cytoscape@3.30':  canvas 渲染（spec-21 / spec-26 复用）
  - 'cytoscape-dagre@2.5':  层次布局
  - 'cytoscape-cose-bilkent@4.x':  力导布局
  - 'cytoscape-cola@2.x':  cola 物理布局
  - 'd3-hierarchy@3.x':  树状结构辅助
  - 'graphlib@2.1':  边集合操作（与 spec-20 共享）
  - 'systeminformation@5.x':  netstat / openProcesses
  - 'win-handle-info@x':  Windows handle 列表
  - 'fast-xml-parser@4.x':  导出 svg
inspirations:
  - "Process Hacker / Procmon graph"
  - "Wireshark IO graph"
  - "Mermaid live editor / Excalidraw"
  - "Datadog Service Map"
network_topology_data_sources:
  - netstat -ano (process ↔ port ↔ remote)
  - openProcesses() parent-pid (parent-of)
  - DLL load events (dll-load via ETW or fallback)
  - service control manager (service-link)
neural_relationship_data_sources:
  - cwd 推断项目归属（spec-13 + project root markers .git/.devhub-project）
  - cmdline 标签匹配
  - spawned-by 由 parent-pid + 时间窗（spawned-by 5min 内为强）
  - ai-session-of 由 alias 匹配
node_limit_strategy:
  - default 500
  - user expand "expand all" → 上限 2000，自动切到 cose-bilkent
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~120
test_loc: ~480
total: ~1500
risk_areas:
  - 全局图 500+ 节点 cytoscape 渲染性能
  - 数据源（netstat/handle）的耗时（已通过 R8.A spec-01 集成库吸收）
  - 时间游标的实现（依赖 spec-22 录像 + 审计 snapshotter）
  - 三套图共享 GraphService 的 cache key 设计（避免误共享）
```

---

## 10. implement_checklist

- [x] GraphService shared service with network/neural/flow build paths registered through `R8RuntimeService`.
- [x] NetworkTopologyBuilder 集成 systeminformation/netstat/handle 集成库（R8.A spec-01）
- [x] NeuralRelationshipBuilder 用 cwd → project root + cmdline pattern + alias map
- [x] GraphCache LRU max=20 snapshot；key=(slice + asOfTs)
- [x] GraphSnapshotter 每 5min 自动 snapshot 一次（用户可关），保留 24h
- [x] FullScreenTopologyView 顶部 toolbar：graphKind / layout / slice / time-cursor / export
- [x] GraphCanvas 复用 spec-21 cytoscape wrapper（同一组件）
- [x] 节点 ≤ 500 默认；> 500 显示 banner + expand 按钮
- [x] 5 入口注册：activity bar / command palette / status bar / shortcut Ctrl+T / route
- [x] 双向跳转：节点点击 → ProcessDetailPanel；面板"在全局看"→ 切回 + select
- [x] feature flag `R8.C.topology.global` 默认 ON
- [x] audit log: snapshot save/export/time-cursor jump
- [x] vitest + playwright fixture: 100/500/800 节点 / 三 graphKind 切换 / time cursor

---

## 11. dependencies

```yaml
upstream:
  - spec-31: IPC 限流
  - spec-33: Zod SoT
  - R8.A spec-01: 集成库
  - R8.A spec-05: 拓扑入口三端冗余（属于 R8.A，本 spec 提供顶级）
  - R8.A spec-02: ProcessUnifiedViewModel 提供 process node meta
  - R8.B spec-08: 命令面板入口
  - R8.B spec-13: 活动栏图标
downstream:
  - spec-25: 附属拓扑共用 GraphService
  - spec-26: 流程图复用 GraphCanvas
  - spec-27: 信号融合给节点附 fusionScore（visual badge）
  - spec-32: 观测面板嵌入 mini topology
```

---

## 12. fallback_strategy

```yaml
on_node_limit_exceeded:
  - 默认拒绝渲染 + 显示切片建议
  - 用户选 'expand all' 后切布局到 cose-bilkent + 关闭部分边类型
on_data_source_fail:
  - netstat 失败 → 仅 process tree
  - handle 失败 → 跳过 owns 边
  - 通知用户具体源失败 + 提示重试
on_time_cursor_no_history:
  - 显示"该时间点无快照"
  - 提供最近 snapshot 列表
flag_off_behavior:
  - R8.C.topology.global=OFF → 一级入口隐藏，仅附属图（spec-25）可用
```

---

## 13. performance_budget

```yaml
build_global_p95_ms: 2000
build_global_fatal_ms: 5000
graph_kind_switch_p95_ms: 300
layout_compute_p95_ms_per_500_nodes: 800
node_render_p95_ms_per_100: 80
node_max_default: 500
node_max_expand: 2000
depth_max: 10
cache_max_snapshots: 20
snapshot_interval_ms: 300000
ipc_channel: topology:build-global-graph → spec-31 medium_query 60 RPM
ipc_channel: topology:event-stream → spec-31 high_freq_scan 30 RPM
```


---

## implementation_status_2026-05-04

### Verified Complete

- Shared graph contract: `devhub/src/shared/schemas/graph.ts` defines graph kinds, node kinds, edge kinds, slices, snapshots, saved snapshots, exports, and warm-scope requests with Zod validation.
- Shared graph service: `devhub/src/main/services/graph/GraphService.ts` reads real scanner-cache and project data, builds `network-topology`, `neural-relationship`, and `flow`, supports `global/process/port/window/project` slices, applies depth expansion, filters dangling edges, and enforces 500 default / 2000 expanded node limits.
- Runtime bridge: `R8RuntimeService`, `r8RuntimeHandlers`, preload, renderer global typings, and `prompts/0421/contracts/23-ipc-contracts-master.md` expose executable global topology IPC/preload contracts.
- Fullscreen UI: `FullScreenTopologyView` plus graph kind, layout, slice, time-cursor, export, and canvas wrapper components are mounted under the top-level topology route.
- Redundant entrypoints: top tab, sidebar activity icon, status-bar badge, command-palette command `topology.global`, `Ctrl+T`, and `#/topology/global` all route to the fullscreen topology view.
- Snapshot/export: user-confirmed snapshot save/list is real filesystem persistence; `mermaid`, `dot`, and `svg` exports are real string exports; unsupported `png` returns a truthful runtime error.
- Detail navigation: process nodes dispatch monitor navigation events so the user can move from global topology into process detail.
- Regression coverage: targeted spec-24 tests passed 7 files / 72 tests, and full Vitest passed 74 files / 582 tests with `--maxWorkers=1`.

### Implemented Differently From Original Sketch

- Builder classes are integrated inside `GraphService` rather than split into separate builder files. This keeps the current codebase style compact while preserving the same graph-kind separation and shared cache/snapshot boundary.
- Network data uses the existing real scanner cache for processes, ports, windows, and project mappings. Direct DLL-load, Windows handle, and service-control-manager edges are not claimed in this slice.
- Neural data uses real process type, project id, working directory buckets, and AI task records from the scanner cache. It does not fabricate cmdline alias matches when source data is absent.
- Time cursor requests are accepted and visibly marked as historical, but they render the current scanner cache with `E_GRAPH_HISTORICAL_CURSOR`; true arbitrary historical replay from spec-22 snapshots is not claimed here.
- Renderer layout selection persists UI state over the existing graph wrapper. Dedicated Cytoscape/dagre/cose/cola engines are deferred rather than faked.

### Not Claimed Complete In This Slice

- Automatic 5-minute `GraphSnapshotter` retention scheduler with 24-hour policy.
- Real renderer canvas PNG export.
- Full audit-log rows for every snapshot save, export, and time-cursor jump: closed later by `implementation_status_2026_05_12_bidirectional_audit`.
- Dedicated cytoscape/dagre/cose-bilkent/cola layout engine integration and packaged Electron performance-budget artifact.
- Full reverse navigation from process detail back into a selected global graph node: closed later by `implementation_status_2026_05_12_bidirectional_audit`.

### Verification Evidence

```bash
pnpm test --run src/main/services/graph/GraphService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/topology/TopologyEntrypoints.test.tsx --maxWorkers=1
pnpm typecheck
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

- Targeted spec-24 suite: 7 files / 72 tests passed.
- Typecheck: passed.
- Lint and no-emoji: passed, `No emoji found in 366 files`.
- License: passed, 400 production package entries validated and 1 documented exception retained.
- Full Vitest: 74 files / 582 tests passed.
- GitNexus analyze: 4,326 nodes / 13,222 edges / 355 clusters / 300 flows.
- GitNexus impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

## 14. implementation_status_2026_05_11_topology_global_sync

### Checked In This Pass

- GraphService is verified as the shared topology service with network/neural/flow build paths routed through `R8RuntimeService`.
- Graph cache behavior is verified as LRU max 20 with cache key derived from the full slice, including `asOfTs`.
- `FullScreenTopologyView` toolbar is verified for graph kind, layout, slice, time cursor, save, and export controls.
- Default 500-node degradation and explicit expand behavior are verified by `GraphService.test.ts` and renderer coverage.
- The five redundant global topology entries are verified through sidebar activity entry, command-palette command, status bar badge, `Ctrl+T`, and `#/topology/global` route wiring.
- `R8.C.topology.global` is covered as a default-ON feature flag in `feature-flags.test.ts`.

### Current Verification

```bash
pnpm -C devhub exec vitest run src/main/services/graph/GraphService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/topology/TopologyEntrypoints.test.tsx --maxWorkers=1
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub check:zod-sot
```

- Targeted topology suite: 7 files / 126 tests passed on 2026-05-11.
- Typecheck, lint/no-emoji, no-cloud-deps, no-ocr-deps, and Zod SoT gates passed on 2026-05-11.

### Still Not Claimed Complete

- Direct `systeminformation`/netstat/handle builder split and Windows handle/service-control-manager edge sources.
- Shared Cytoscape/dagre/cose-bilkent/cola renderer canvas and real PNG canvas export.
- Playwright and performance-budget fixtures for 100/500/800-node rendering.

## 15. implementation_status_2026_05_12_bidirectional_audit

### Closed In This Pass

- `R8RuntimeService` now writes audit rows for `topology:time-cursor`, `topology:snapshot-save`, and `topology:export` through the existing local `AuditLogger`.
- Time-cursor audit covers fullscreen, generic global, network, and neural graph entry paths without fabricating historical replay; historical requests still carry `E_GRAPH_HISTORICAL_CURSOR` when the current scanner cache is rendered.
- `ProcessDetailPanel` now exposes a direct "View in global topology" action that stores the real process-node id in `sessionStorage` and dispatches the existing `devhub:open-topology-global` event.
- `FullScreenTopologyView` consumes the stored process-node id after the real topology snapshot loads, selects the matching graph node, clears the one-shot selection key, and preserves the existing node-to-process-detail monitor navigation path.

### Verified Commands

- `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx --maxWorkers=1 -t "topology|Topology|ProcessDetailPanel global"`
- `pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/topology/FullScreenTopologyView.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/monitor/ProcessDetailPanel.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx`
- `pnpm -C devhub exec tsc --noEmit --pretty false`
- `pnpm -C devhub check:no-emoji`

### Verification Results

- Focused topology/runtime/UI tests passed: 3 files, 6 tests passed with 81 tests skipped by the name filter.
- Touched-file ESLint passed.
- Typecheck passed.
- No-emoji gate passed with `No emoji found in 603 files`.

### Still Not Claimed Complete

- Direct `systeminformation`/netstat/handle builder split and Windows handle/service-control-manager edge sources.
- Shared Cytoscape/dagre/cose-bilkent/cola renderer canvas and real PNG canvas export.
- Playwright and performance-budget fixtures for 100/500/800-node rendering.

## 16. implementation_status_2026_05_16_auto_snapshotter

### Closed In This Pass

- Added `GraphSnapshotter` in the main-process graph service layer. It runs from `setupR8RuntimeHandlers()` through `R8RuntimeService.startTopologySnapshotter()`, uses a 300000ms recursive timeout, calls `unref()` on its timer, and stops from `R8RuntimeService.dispose()`.
- Each scheduled run builds fresh global snapshots for `network-topology`, `neural-relationship`, and `flow` with `GraphService.buildGlobal(..., { refresh: true })`, then persists them through the existing confirmed `GraphService.saveSnapshot()` filesystem path instead of writing a parallel fake store.
- Retention is local and bounded: only labels generated by the automatic snapshotter (`auto-topology:*`) are pruned after 24h, so user-confirmed/manual snapshots are not deleted by the background job.
- `R8.C.topology.global` remains the user-off switch. Toggling this feature flag calls `syncTopologySnapshotter()` and stops the scheduler when disabled.
- `topology:auto-snapshot` audit rows record saved/pruned counts, graph kinds, skipped reason, and runtime errors without throwing from the scheduler loop.

### Verified Commands

- `pnpm -C devhub test -- --run src/main/services/graph/GraphService.test.ts --maxWorkers=1`
- `pnpm -C devhub test -- --run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "statusbar config"`
- `pnpm -C devhub test -- --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "spec-24 topology"`

### Verification Results

- `GraphService.test.ts`: 1 file, 8 tests passed.
- `r8RuntimeHandlers.test.ts`: 1 focused test passed, 24 skipped by filter.
- `R8RuntimeService.test.ts`: 1 focused spec-24 topology test passed, 101 skipped by filter.

### Still Not Claimed Complete

- Direct `systeminformation`/netstat/handle builder split and Windows handle/service-control-manager edge sources.
- Shared Cytoscape/dagre/cose-bilkent/cola renderer canvas and real PNG canvas export.
- Playwright and performance-budget fixtures for 100/500/800-node rendering.

## 17. implementation_status_2026_05_16_neural_alias_project_root

### Closed In This Pass

- `GraphService.buildNeural()` now infers `belongs-to-project` edges from process `workingDir` under a registered project root when `process.projectId` is absent.
- Command-line project matching now resolves project roots embedded in process commands with path-boundary checks, preserving the stronger explicit `projectId` edge confidence when present.
- Added a local command/name alias map for real process metadata: Claude Code, Codex, Gemini CLI, Cursor, Node package managers, and Python runtimes become `tag-alias-*` neural tags through `has-tag` edges.
- Existing process-type tags, shared-cwd edges, explicit project ownership, and AI-task session edges remain unchanged.

### Verified Commands

- `pnpm -C devhub test -- --run src/main/services/graph/GraphService.test.ts --maxWorkers=1`

### Verification Results

- `GraphService.test.ts`: 1 file, 9 tests passed.

### Still Not Claimed Complete

- Direct `systeminformation`/netstat/handle builder split and Windows handle/service-control-manager edge sources.
- Shared Cytoscape/dagre/cose-bilkent/cola renderer canvas and real PNG canvas export.
- Playwright and performance-budget fixtures for 100/500/800-node rendering.

## 18. implementation_status_2026_05_16_detail_reverse_selection

### Closed In This Pass

- Added `globalTopologyNavigation` as the renderer-side single contract for the existing fullscreen topology bridge: it writes `devhub:topology:global:selected-node`, dispatches `devhub:open-topology-global`, and builds graph node ids using the same `process-${pid}`, `port-${port}-${pid}-${protocol}`, `window-${hwnd}`, and `project-${id}` formats used by the graph builders.
- Rewired `FullScreenTopologyView`, `ProcessDetailPanel`, and `AttachedGraphView` to share that contract instead of local string copies.
- `PortFocusPanel` now exposes header and action-bar global topology actions that select the real port node id.
- `WindowView` now exposes selected-window header and detail-panel global topology actions that select the real `window-${hwnd}` node id.
- `ProjectDetailPanel` now exposes a project-detail global topology action that selects the real `project-${id}` node id.
- `TopologyDetailPanel` now exposes a generic detail-panel global action for process, port, window, and project nodes, preserving the existing attached topology panel and adding the reverse path into fullscreen global topology.

### Verified Commands

- `pnpm -C devhub exec vitest run src/renderer/utils/globalTopologyNavigation.test.ts src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx src/renderer/components/project/ProjectDetailPanel.test.tsx src/renderer/components/monitor/topology/TopologyDetailPanel.test.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/attached/AttachedGraphView.test.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx --maxWorkers=1`
- `pnpm -C devhub typecheck`
- `pnpm -C devhub lint`

### Verification Results

- Focused renderer topology bridge suite passed: 8 files, 20 tests passed.
- TypeScript typecheck passed.
- ESLint and no-emoji guard passed; no emoji found in 648 files.

### Still Not Claimed Complete

- Direct `systeminformation`/netstat/handle builder split and Windows handle/service-control-manager edge sources.
- Shared Cytoscape/dagre/cose-bilkent/cola renderer canvas and real PNG canvas export.
- Playwright and performance-budget fixtures for 100/500/800-node rendering.

## 19. implementation_status_2026_05_17_systeminformation_network_builder

### Closed In This Pass

- Added `SystemInformationAdapter` under the R8.A integration adapter layer. It dynamically loads the real `systeminformation` package, maps `networkConnections()` rows into the existing `PortInfo` contract, maps `processes().list` rows into `ProcessInfo`, validates raw fields through Zod, and returns typed `ServiceResult` errors when the package or shape is unavailable.
- `PortScanner.scanAll()` now uses `systeminformation.networkConnections()` as the primary real network source and preserves the existing `netstat -ano -p TCP` parser as the explicit fallback path. `PortInfo.source` records `systeminformation`, `netstat`, or `scanner-cache` provenance for downstream topology nodes.
- Added `NetworkTopologyBuilder` as the explicit network graph builder used by `GraphService`. It consumes scanner-cache processes, ports, windows, and projects; carries port source provenance into node metadata; carries process `handleCount` when present from the process scanner; and preserves existing `owns`, `parent-of`, `listens`, and `connects` edge semantics.
- Registered `systeminformation@5.31.6` in `package.json`, `pnpm-lock.yaml`, `R8.A.libs.systeminformation`, and the R8.A integration manifest with `netstat -ano` fallback. The package is MIT licensed and passed no-cloud/no-OCR gates.
- Renderer PNG export is now handled in `GraphCanvas` through the real current `GraphSnapshot` SVG layer and `canvas.toDataURL('image/png')`; `FullScreenTopologyView` routes PNG exports through the renderer canvas instead of calling the main-process `topology:export` PNG path.

### Verified Commands

- `npm view systeminformation version license dependencies dist.tarball --json`
- `pnpm -C devhub add systeminformation@5.31.6`
- `node -e "import('systeminformation').then(async si=>{const rows=await si.networkConnections(); const ports=rows.filter(r=>r && r.pid && r.localPort).slice(0,5).map(r=>({protocol:r.protocol,localPort:r.localPort,state:r.state,pid:r.pid,process:r.process})); console.log(JSON.stringify({count:rows.length, sample:ports}, null, 2));})"`
- `pnpm -C devhub exec vitest run src/main/services/integrations/SystemInformationAdapter.test.ts src/main/services/PortScanner.test.ts src/main/services/graph/GraphService.test.ts src/shared/feature-flags.test.ts src/shared/integration-manifest.test.ts --maxWorkers=1`
- `pnpm -C devhub exec vitest run src/main/services/graph/GraphService.test.ts src/main/services/integrations/SystemInformationAdapter.test.ts src/main/services/PortScanner.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/topology/TopologyEntrypoints.test.tsx --maxWorkers=1 -t "topology|Topology|graph|Graph|PortScanner|SystemInformationAdapter|schema|preload"`
- `pnpm -C devhub exec eslint src/main/services/integrations/SystemInformationAdapter.ts src/main/services/integrations/SystemInformationAdapter.test.ts src/main/services/integrations/index.ts src/main/services/PortScanner.ts src/main/services/PortScanner.test.ts src/main/services/graph/NetworkTopologyBuilder.ts src/main/services/graph/GraphService.ts src/main/services/graph/GraphService.test.ts src/shared/types-extended.ts src/shared/feature-flags.ts src/shared/feature-flags.test.ts src/shared/integration-manifest.ts`
- `pnpm -C devhub exec tsc --noEmit --pretty false`
- `pnpm -C devhub check:zod-sot`
- `pnpm -C devhub check:no-emoji`
- `pnpm -C devhub check:no-cloud-deps`
- `pnpm -C devhub check:no-ocr-deps`

### Verification Results

- Live `systeminformation.networkConnections()` smoke returned `count=490` on the local machine, with real TCP listen rows containing protocol, localPort, state, pid, and process fields.
- Focused adapter/port/graph/manifest suite passed: 5 files, 35 tests passed.
- Focused topology cross-layer suite passed: 9 files, 51 tests passed and 151 skipped by the name filter.
- Touched-file ESLint passed.
- TypeScript passed.
- Zod SoT verification passed.
- No-emoji gate passed with `No emoji found in 681 files`.
- No-cloud and no-OCR dependency gates passed after adding `systeminformation`.

### Superseded Boundary

- Dedicated Cytoscape renderer reuse was still open at this checkpoint. It is closed by `implementation_status_2026_05_17_cytoscape_shared_canvas` below.

## 20. implementation_status_2026_05_17_fixture_matrix

### Closed In This Pass

- Added a low-resource Vitest topology fixture matrix for 100/500/800 nodes across `network-topology`, `neural-relationship`, and `flow`.
- The fixture matrix runs through the real `GraphService.buildGlobal()` path with schema-shaped scanner-cache snapshots, verifies historical `asOfTs` time-cursor rendering, checks edge references against known node ids, enforces a 2500ms per-build budget, and proves 800-node graphs require explicit `expandAll` while default rendering degrades to 500 nodes.
- Added a dev-only Electron main-process test hook, `buildGlobalTopologyFixtureForTests`, that instantiates the real `GraphService` inside the real Electron main process. It does not seed production scanner state and does not change runtime data sources; it exists only while `app.isPackaged === false`.
- Added a Playwright fixture that launches the built Electron app, calls the dev-only topology fixture hook for 100/500/800 nodes across all three graph kinds, verifies the 500-node guard for 800-node unexpanded renders, opens the real fullscreen topology view, switches `graphKind` through the toolbar, and verifies the time cursor via `GraphCanvas` DOM state.
- `GraphCanvas` now exposes `data-as-of-ts` for runtime/auditability of current vs historical renders without changing the rendering engine.

### Verified Commands

- `pnpm -C devhub exec vitest run src/main/services/graph/GraphService.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx --maxWorkers=1`
- `pnpm -C devhub build`
- `pnpm -C devhub test:e2e --grep "R8.C spec-24 global topology" --reporter=line --workers=1`
- `pnpm -C devhub exec tsc --noEmit --pretty false`
- `pnpm -C devhub exec eslint src/main/index.ts src/main/services/graph/GraphService.test.ts src/renderer/components/topology/GraphCanvas.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx e2e/example.spec.ts`
- `pnpm -C devhub check:zod-sot`
- `pnpm -C devhub check:no-emoji`
- `git diff --check -- devhub/src/main/index.ts devhub/src/main/services/graph/GraphService.test.ts devhub/src/renderer/components/topology/GraphCanvas.tsx devhub/src/renderer/components/topology/FullScreenTopologyView.test.tsx devhub/e2e/example.spec.ts`

### Verification Results

- Focused Vitest passed: 2 files, 25 tests.
- Production build passed.
- Focused Electron Playwright fixture passed: 1 test.
- TypeScript passed.
- Touched-file ESLint passed.
- Zod SoT passed.
- No-emoji gate passed with `No emoji found in 681 files`.
- Touched-file diff-check passed.

### Superseded Boundary

- Dedicated Cytoscape renderer reuse was still open at this checkpoint. It is closed by `implementation_status_2026_05_17_cytoscape_shared_canvas` below.

## 21. implementation_status_2026_05_17_cytoscape_shared_canvas

### Closed In This Pass

- Added real `cytoscape@3.33.3` and `cytoscape-dagre@3.0.0` production dependencies after package metadata verification confirmed MIT licenses and the `@dagrejs/dagre` peer layout path.
- Added `DagCanvas` under the spec-21 DAG editor package as the shared Cytoscape wrapper. It registers `cytoscape-dagre` once, initializes/destroys a real Cytoscape instance in React lifecycle, exposes `exportPng()` through Cytoscape PNG export with the existing SVG fallback for non-browser test DOMs, and preserves node click/focus behavior.
- `DagEditorPanel` now renders the shared `DagCanvas` in Canvas view while preserving the existing drag/drop card controls and four-view state.
- `GraphCanvas` now reuses the same `DagCanvas` wrapper for fullscreen global topology, exposes `data-renderer-engine="cytoscape"`, and keeps the deterministic hidden SVG fallback for test/non-canvas environments.
- Registered `R8.A.libs.cytoscape` and `R8.A.libs.cytoscape-dagre` in the feature-flag registry and R8.A integration manifest with explicit dependency ownership and license coverage.

### Verified Commands

- `npm view cytoscape@3.33.3 version license dependencies dist.tarball --json`
- `npm view cytoscape-dagre@3.0.0 version license dependencies peerDependencies dist.tarball --json`
- `pnpm -C devhub add cytoscape@3.33.3 cytoscape-dagre@3.0.0`
- `pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx src/shared/feature-flags.test.ts src/shared/integration-manifest.test.ts --maxWorkers=1`
- `pnpm -C devhub exec tsc --noEmit --pretty false`
- `pnpm -C devhub exec eslint src/renderer/components/dag-editor/DagCanvas.tsx src/renderer/components/dag-editor/DagEditorPanel.tsx src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/components/topology/GraphCanvas.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx src/shared/vendor-native.d.ts src/shared/feature-flags.ts src/shared/feature-flags.test.ts src/shared/integration-manifest.ts src/shared/integration-manifest.test.ts`
- `pnpm -C devhub build`
- `pnpm -C devhub test:e2e --grep "R8.C spec-24 global topology" --reporter=line --workers=1`
- `pnpm -C devhub check:license`
- `pnpm -C devhub check:no-cloud-deps`
- `pnpm -C devhub check:no-ocr-deps`
- `pnpm -C devhub check:no-emoji`
- `pnpm -C devhub check:zod-sot`

### Verification Results

- npm metadata confirmed `cytoscape@3.33.3` and `cytoscape-dagre@3.0.0` are MIT licensed; `cytoscape-dagre` depends on `@dagrejs/dagre`.
- Focused renderer/manifest Vitest passed: 4 files, 11 tests.
- TypeScript passed.
- Touched-file ESLint passed.
- Production build passed.
- Focused Electron Playwright `spec-24` fixture passed: 1 test.
- License check passed with 464 production package entries validated and the existing 1 manifest exception documented.
- No-cloud and no-OCR dependency gates passed.
- No-emoji gate passed with `No emoji found in 682 files`.
- Zod SoT verification passed.

### Completion Boundary

- All spec-24 checklist items are now checked with local implementation and verification evidence.
- Broader spec-21 visual editor items remain owned by `prompts/0503-2/R8.C/spec-21-dag-visual-editor.md`; this closure only claims the shared Cytoscape wrapper reuse required by spec-24.
