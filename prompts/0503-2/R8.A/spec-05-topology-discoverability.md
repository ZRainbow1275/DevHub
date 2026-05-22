# R8.A spec-05 — 拓扑入口可见性 + 网络拓扑 / 神经关系图入口三端贯通

> **batch**: R8.A | **rank**: #5 | **user-perception-assert**: ASSERT_TOPOLOGY_FIRST_GLANCE
> **status**: planning -> spec
> **target_audience**: AI implementation agents
> **derived_from**: V1-Q-4.H.1 / V1-Q-8.H.1/H.2 + V2-Q-13.A/B/I.2 + V2-Q-14 全表 + 5 大反馈 #2.2
> **signed**: ZRainbow 2026-05-03
> **depends_on**: spec-01

---

## 1. motivation

### 1.1 用户原话与锚点

```yaml
user_statements:
  - source: 5 大反馈 #2.2
  raw: "原本设计的：『打开资源后可以查看网络拓扑图和神经关系图』的设计消失了，要在进程、端口、窗口三端都得到应用，作为串联"
  impact: 必须暴露两套图（网络拓扑 + 神经关系）三端入口
  - source: V1-Q-4.H.1
  raw: "B + D + E"
  impact: 进程详情：保留子 Tab + 顶部主按钮 + 卡片角标
  - source: V1-Q-8.H.1
  raw: "是，作为一级入口"（V1）
  delta: 与 5 大反馈"应是附属"矛盾 -> Q-13.I.2 选 D（双重存在 + 职责分离）
  impact: 全局 Tab + 三端附属并存；本 spec 实施附属，全局入口在 R8.B-spec-15
  - source: V2-Q-14.A.1
  raw: "选项 A：网络拓扑 (OS-level) + 神经关系 (语义)"
  impact: 两套图必须独立，schema 不同
  - source: V2-Q-14.B.3
  raw: "三端附属 3 入口冗余：子 Tab + 顶部主按钮 + 卡片角标"
  impact: 本 spec 主要落地点
  - source: master §9 ASSERT_TOPOLOGY_FIRST_GLANCE
  raw: 详情面板首屏 1s 内可见 ≥ 1 个"查看关系图"入口
```

### 1.2 工程背景

- refs/source-snapshot-v2.md 维度 7：NeuralGraphEngine 已实现，PortFocusPanel:534 已嵌入 AttachedGraphView，但 ProcessDetailPanel 仅文字列表无图、WindowView 入口位置不明，TopologyView 全局视图无 4-Tab 入口。
- 用户在 R7/R8 反复说"消失"= 入口被埋。
- 本 spec 在三端详情中暴露入口；不重写图引擎；不做全局入口（R8.B-spec-15 处理）。

### 1.3 为什么放在 #5

5 大反馈 #2.2 是用户最痛的"消失感"问题；本 spec 是 R8.A 5 条用户感知断言中的第二条。

---

## 2. affected_source

```yaml
files:
  - path: devhub/src/renderer/components/monitor/ProcessDetailPanel.tsx
  lines: "顶部 + 关联 Tab"
  op: MODIFY
  detail: 顶部加大按钮 "看图"；关联 Tab 升级为 嵌入 AttachedGraphView
  - path: devhub/src/renderer/components/monitor/ProcessDetailDrawer.tsx
  op: MODIFY
  detail: 同上，drawer 内嵌图 mini 版
  - path: devhub/src/renderer/components/monitor/PortFocusPanel.tsx
  lines: "534"
  op: REFACTOR
  detail: 拆分为两 Tab "网络拓扑" + "神经关系"；保留 AttachedGraphView 但 scope 多 kind
  - path: devhub/src/renderer/components/monitor/WindowView.tsx
  op: MODIFY
  detail: 加详情面板顶部主按钮 + 关系图子 Tab
  - path: devhub/src/renderer/components/monitor/topology/AttachedGraphView.tsx
  op: MODIFY
  detail: scope 接受 graph_kind: 'network' | 'neural'；切换数据源
  - path: devhub/src/renderer/components/monitor/topology/NetworkTopologyView.tsx
  op: CREATE
  detail: graph_kind='network' 的 view；走 OS-level 数据
  - path: devhub/src/renderer/components/monitor/topology/NeuralRelationshipView.tsx
  op: CREATE
  detail: graph_kind='neural' 的 view；走推断数据
  - path: devhub/src/renderer/components/badges/RelationshipBadge.tsx
  op: CREATE
  detail: 卡片右上角角标，hover 提示，click 跳转
  - path: devhub/src/renderer/components/cards/ProcessCard.tsx
  op: MODIFY
  detail: 加 RelationshipBadge
  - path: devhub/src/renderer/components/cards/PortCard.tsx
  op: MODIFY
  detail: 加 RelationshipBadge
  - path: devhub/src/renderer/components/cards/WindowCard.tsx
  op: MODIFY
  detail: 加 RelationshipBadge
  - path: devhub/src/main/services/topology/NetworkTopologyService.ts
  op: CREATE
  detail: OS-level 图数据组装（依 ProcessUnifiedViewModel.relationships + netstat）
  - path: devhub/src/main/services/topology/NeuralRelationshipService.ts
  op: CREATE
  detail: 语义/推断图（cwd / cmdline / 标签 / ai-task）
  - path: devhub/src/main/ipc/topologyHandlers.ts
  op: MODIFY
  detail: 新增 topology:network:get / topology:neural:get
  - path: devhub/src/renderer/hooks/useFirstGlanceProbe.ts
  op: CREATE
  detail: dev mode 启动 1s 内扫 details viewport，检查至少 1 入口
```

---

## 3. data_contracts

### 3.1 graph kind enum

```typescript
import { z } from 'zod';

export const graphKindSchema = z.enum(['network','neural','flow']);

export const graphScopeSchema = z.object({
  kind: z.enum(['process','port','window','project','ai-task']),
  target_id: z.string(),  // pid / port / hwnd / projectId / taskId
  depth: z.number().int().min(1).max(10).default(2),
  graph_kind: graphKindSchema,
});

export const networkEdgeKindSchema = z.enum([
  'listens','connects','established','owns','parent','child','loaded-dll','opens-file','service-of','belongs-to-virtual-desktop',
]);

export const neuralEdgeKindSchema = z.enum([
  'belongs-to-project','has-tag','shares-cwd','spawned-by','same-exe','part-of-cluster',
  'inferred-from-cmdline','assigned-to-ai-task','executed-skill','part-of-csv-batch','alias-of','related-to',
]);

export const graphNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(['process','port','window','project','external','tag','ai-task','cluster','skill','csv-batch']),
  label: z.string(),
  attrs: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const graphEdgeSchema = z.object({
  source: z.string(),
  target: z.string(),
  kind: z.union([networkEdgeKindSchema, neuralEdgeKindSchema]),
  confidence: z.number().min(0).max(1).default(1),
});

export const graphResponseSchema = z.object({
  scope: graphScopeSchema,
  generated_at: z.string().datetime(),
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
  truncated: z.boolean(),
});

export type GraphScope = z.infer<typeof graphScopeSchema>;
export type GraphResponse = z.infer<typeof graphResponseSchema>;
```

### 3.2 三端入口冗余清单

```yaml
process_detail_entries:
  - top_button: "查看关系图"（panel & drawer 顶部 toolbar）
  - sub_tab_network: "网络拓扑"
  - sub_tab_neural: "神经关系"
  - card_badge: ProcessCard 右上 RelationshipBadge
  - cmdk_action: "查看进程关系图 PID=N"

port_detail_entries:
  - top_button: "查看关系图"
  - sub_tab_network
  - sub_tab_neural
  - card_badge: PortCard 右上
  - cmdk_action: "查看端口关系图"

window_detail_entries:
  - top_button: "查看关系图"
  - sub_tab_network
  - sub_tab_neural
  - card_badge: WindowCard 右上
  - cmdk_action: "查看窗口关系图"
```

---

## 4. ipc_contracts

```yaml
new_channels:
  - name: topology:network:get
  direction: renderer -> main
  request_schema: graphScopeSchema.refine(s => s.graph_kind === 'network')
  response_schema: graphResponseSchema
  p95_target_ms: 600
  - name: topology:neural:get
  direction: renderer -> main
  request_schema: graphScopeSchema.refine(s => s.graph_kind === 'neural')
  response_schema: graphResponseSchema
  p95_target_ms: 800
  - name: topology:flow:get
  direction: renderer -> main
  detail: 第三套图 流程图；R8.A 仅签字段，渲染在 R8.C-spec-26
  request_schema: graphScopeSchema.refine(s => s.graph_kind === 'flow')
  response_schema: graphResponseSchema
deprecated_channels:
  - name: topology:get-attached
  replaced_by: topology:network:get / topology:neural:get
```

---

## 5. error_matrix

| condition | error_code | UI surface | recovery |
|-----------|------------|------------|----------|
| scope.target_id 不存在 | TARGET_GONE | toast + 关闭图 | parent close |
| 图节点 > 500 | GRAPH_TRUNCATED | banner + "降深度" 提示 | 自动降深度（max-1） |
| 图节点 > 5000 | GRAPH_REFUSE | 错误占位 + 入口仍可见 | 必须用户先筛选 |
| 后端服务异常 | TOPOLOGY_SERVICE_DOWN | banner.error + 重试 | 5s backoff retry x 3 |
| ASSERT_TOPOLOGY_FIRST_GLANCE 失败（dev probe）| FIRST_GLANCE_VIOLATION | dev: console + 启动期 fail-fast | 修代码 |
| 卡片角标点击但 graph 服务未就绪 | NOT_READY | toast | 1s 后自动重试 |

---

## 6. acceptance_gwt

```gherkin
Feature: 三端拓扑/关系图入口可见性

Scenario A1: ASSERT_TOPOLOGY_FIRST_GLANCE 必过（进程详情）
  Given pid=8812 进程详情打开
  When 1s 内进行 first-glance probe
  Then DOM 中可见至少 1 个 [data-graph-entry] 元素
  And 顶部按钮、子 Tab、卡片角标三者中至少 1 个 visible

Scenario A2: 同上（端口详情）
  Given port=3000 详情打开
  When 1s 内 probe
  Then 至少 1 个 [data-graph-entry] visible

Scenario A3: 同上（窗口详情）
  Given hwnd=0x12345 详情打开
  When 1s 内 probe
  Then 至少 1 个 [data-graph-entry] visible

Scenario A4: 网络拓扑 vs 神经关系两 Tab 切换
  Given 端口详情已打开
  When 用户点击 "网络拓扑" Tab
  Then topology:network:get 被调用
  And edges 全部为 networkEdgeKind
  When 用户点击 "神经关系" Tab
  Then topology:neural:get 被调用
  And edges 全部为 neuralEdgeKind

Scenario A5: 卡片角标 click 直接跳到关系图全屏
  Given 卡片列表显示 ProcessCard pid=8812
  When 用户 click RelationshipBadge
  Then 详情面板打开
  And "网络拓扑" Tab 默认激活
  And [data-vm-pid="8812"] 节点居中

Scenario A6: cmdk 入口
  Given Cmd+K 命令面板打开
  When 输入 "关系图"
  Then 出现 3 项："查看进程关系图" "查看端口关系图" "查看窗口关系图"
  And 选择第 1 项 -> 弹 PID 输入 -> 跳转

Scenario A7: 图过大降级
  Given pid=4 (System) 子节点超过 500
  When topology:network:get 调用
  Then truncated=true
  And UI banner "图过大，已降至深度 1"
  And 用户可手动加深
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/r8a/spec-05-topology-discoverability.spec.ts
import { test, expect, _electron as electron } from '@playwright/test';

test('ASSERT_TOPOLOGY_FIRST_GLANCE: process detail shows graph entry within 1s', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=进程');
  const startTime = Date.now();
  await win.click('[data-pid="8812"]');
  await win.waitForSelector('[data-graph-entry]', { timeout: 1000 });
  expect(Date.now() - startTime).toBeLessThan(1000);
  const entries = await win.locator('[data-graph-entry]').count();
  expect(entries).toBeGreaterThanOrEqual(1);
  await app.close();
});

test('network and neural tabs return distinct edge kinds', async () => {
  const app = await electron.launch({ args: ['./dist/main.js'] });
  const win = await app.firstWindow();
  await win.click('text=端口');
  await win.click('[data-port="3000"]');
  await win.click('[data-graph-tab="network"]');
  const networkEdges = await win.evaluate(async () =>
  window.devhub.testing.getCurrentGraphEdges().map((e: any) => e.kind)
  );
  expect(networkEdges.every((k: string) => ['listens','connects','established','owns','parent','child'].includes(k))).toBe(true);
  await win.click('[data-graph-tab="neural"]');
  const neuralEdges = await win.evaluate(async () =>
  window.devhub.testing.getCurrentGraphEdges().map((e: any) => e.kind)
  );
  expect(neuralEdges.every((k: string) => ['belongs-to-project','has-tag','shares-cwd','spawned-by','same-exe'].includes(k))).toBe(true);
  await app.close();
});
```

---

## 8. reference_impl

| concern | reference |
|---------|-----------|
| Two-graph attached pattern | https://www.figma.com/community (multiple graph layers) |
| Discoverability heuristics | NN/g "Visibility of System Status" |
| Force-directed layout | https://github.com/d3/d3-force |
| Graph schema split | Neo4j multi-label nodes pattern |
| Badge component | Radix UI badges |

---

## 9. impact_radius_loc

```yaml
estimated_loc: 700
breakdown:
  schema + types: 90
  NetworkTopologyService: 130
  NeuralRelationshipService: 130
  AttachedGraphView refactor: 80
  NetworkTopologyView: 50
  NeuralRelationshipView: 50
  RelationshipBadge: 40
  ProcessDetailPanel/Drawer top button + tab: 50
  PortFocusPanel tab split: 40
  WindowView entry: 40
files_touched: ~14
risk_radius:
  - 旧 topology:get-attached caller 全部要迁移
  - badge 数量过多影响卡片视觉密度（与 spec-09 协调）
  - first-glance probe 在 prod 关闭，dev 启用
```

---

## 10. implement_checklist

```yaml
implement_steps:
  - step_01: 定义 graphScopeSchema / graphResponseSchema
  - step_02: NetworkTopologyService（依 wmi-client + netstat 拼装节点/边）
  - step_03: NeuralRelationshipService（cwd 推断 + cmdline 模式 + ai-task 关联）
  - step_04: AttachedGraphView 接入 graph_kind 切换
  - step_05: 三端详情面板顶部加 [data-graph-entry] 主按钮
  - step_06: 子 Tab 拆分 "网络拓扑" / "神经关系"
  - step_07: 卡片角标 RelationshipBadge
  - step_08: cmdk 注册 3 个新 action
  - step_09: useFirstGlanceProbe hook（dev 启用）
  - step_10: 写 e2e（§7）
verify:
  - pnpm typecheck
  - pnpm test
  - pnpm e2e --grep "spec-05"
  - 手测三端 ASSERT_TOPOLOGY_FIRST_GLANCE 通过
```

---

## 11. dependencies

```yaml
blocks:
  - R8.B/spec-15-global-topology-tab.md (全局一级入口)
  - R8.C/spec-24/25/26 (三套图深度)
blocked_by:
  - spec-01-integration-libs.md (xyflow / d3-force)
  - spec-02 弱依赖（relationships 字段；可在 mock 数据上先做 UI）
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - cause: "NetworkTopologyService 慢（>2s）"
  action: "图位 skeleton + 后台拉取；UI 不阻塞"
  - cause: "NeuralRelationshipService 推断置信度全部 < 0.5"
  action: "Tab 显示空态 '暂无可信关系'；提示用户手动建边"
  - cause: "卡片角标在 popout 中显示拥挤"
  action: "popout 模式下角标 hover 才显示"
```

---

## 13. performance_budget

```yaml
budgets:
  badge_render_overhead_per_card: < 0.5ms
  topology_get_p50: 250ms
  topology_get_p95: 600ms (network) / 800ms (neural)
  first_glance_probe_dev_overhead: < 5ms
  graph_render_500_nodes_initial: < 1500ms
  graph_render_200_nodes_initial: < 600ms
  cmdk_action_match: < 30ms
verification:
  - 手测三端 first-glance probe
  - Playwright trace topology p95
```
