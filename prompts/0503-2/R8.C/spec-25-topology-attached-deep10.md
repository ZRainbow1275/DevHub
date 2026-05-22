# R8.C spec-25 — 附属拓扑（10 层 + 8-10 层强制 lazy + 用户主动展开）

> **batch**: R8.C  |  **priority_in_batch**: #25（feedback#5 三端贯通）  |  **flag**: `R8.C.topology.attached`
> **depends_on**: spec-24（GraphService）+ spec-31（IPC 限流）+ spec-33（Zod SoT）+ R8.A spec-04（ProcessDetailPanel）+ R8.A spec-05（三端入口）
> **blocks**: 无（终端功能）
> **decision_anchor**: V1-Q-8.H.2 答 10 层 / V1-Q-8.D.1 答 D 滑块 + 双击扩展 / V1-Q-14.B.3 三端附属（process/port/window）/ feedback#5 三端贯通
> **estimated_loc**: 1300
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_8_h_2: "10 层"
user_quote_v1_q_8_d_1: "D — 滑块控制深度 + 双击扩展"
user_quote_v1_q_14_b_3: "三端都加子 Tab + 顶部主按钮 + 卡片角标（3 入口冗余）"
feedback_5: "网络拓扑图和神经关系图，三端附属，全局并存"

goals:
  - 附属拓扑视图（AttachedTopologyPanel），嵌入 process/port/window 详情面板
  - 三端入口冗余：详情面板的"关系图" Tab + 顶部"看图"按钮 + 卡片角标"图标徽章"
  - 深度滑块：1-10 层，默认 3 层
  - 8-10 层强制 lazy load：仅展开用户双击的节点子树，避免 500+ 节点爆炸
  - 用户主动 expand：单击节点展开 1 层；双击展开当前节点子树到深度上限；右键"展开全部"
  - graphKind 切换：network-topology / neural-relationship（spec-26 流程图作为独立的 spec）
  - 共享 GraphService（spec-24）：避免重复抓取
  - 与全局视图双向同步：在附属图选中节点 → 全局视图同步高亮（用户切回时定位）
  - 自动收纳：详情面板宽度 < 480px 时折叠为 mini-thumbnail（点击展开为浮卡）
  - 收藏：用户可"固定该节点的关系图"作为快捷视图
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/renderer/components/topology/AttachedTopologyPanel.tsx
  - devhub/src/renderer/components/topology/AttachedDepthSlider.tsx
  - devhub/src/renderer/components/topology/LazyExpander.tsx  # 8-10 层 expand on demand
  - devhub/src/renderer/components/topology/AttachedHeaderButton.tsx  # 顶部"看图"
  - devhub/src/renderer/components/topology/CardEdgeBadge.tsx  # 卡片角标
  - devhub/src/renderer/components/topology/AttachedMiniThumbnail.tsx  # < 480px 折叠
  - devhub/src/renderer/components/topology/AttachedNodeFavorites.tsx
  - devhub/src/renderer/components/topology/AttachedTopologyPanel.test.tsx
  - devhub/src/main/services/graph/AttachedGraphFetcher.ts  # 调 GraphService.buildAttached
  - devhub/src/main/services/graph/LazyExpansionPolicy.ts
  - devhub/src/shared/schemas/attached-topology.ts
modified_files:
  - devhub/src/renderer/components/process-detail/ProcessDetailPanel.tsx  # 新增"关系图" Tab + Header 按钮
  - devhub/src/renderer/components/port-focus/PortFocusPanel.tsx  # 升级嵌入位置
  - devhub/src/renderer/components/window-focus/WindowFocusPanel.tsx  # 新增"关系图" Tab
  - devhub/src/renderer/components/process-card/ProcessCard.tsx  # 角标
  - devhub/src/renderer/components/port-card/PortCard.tsx  # 角标
  - devhub/src/renderer/components/window-card/WindowCard.tsx  # 角标
glob_anchors:
  - devhub/src/main/services/graph/GraphService.ts  # spec-24
  - devhub/src/renderer/components/topology/FullScreenTopologyView.tsx  # spec-24 同步
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { GraphSnapshotSchema, GraphKindSchema } from '@/shared/schemas/graph'

export const AttachedScopeKindSchema = z.enum(['process', 'port', 'window'])

export const AttachedTopologyStateSchema = z.object({
  scope: AttachedScopeKindSchema,
  targetId: z.union([z.number(), z.string()]),
  graphKind: GraphKindSchema.default('network-topology'),
  depth: z.number().int().min(1).max(10).default(3),
  expandedNodeIds: z.array(z.string()).default([]),  // lazy expand 集合
  selectedNodeId: z.string().nullable(),
  pinnedFavorites: z.array(z.object({
  label: z.string(),
  targetId: z.union([z.number(), z.string()]),
  scope: AttachedScopeKindSchema,
  graphKind: GraphKindSchema,
  })).default([]),
  thumbnailMode: z.boolean().default(false),  // < 480px 折叠
})
export type AttachedTopologyState = z.infer<typeof AttachedTopologyStateSchema>

export const LazyExpandRequestSchema = z.object({
  scope: AttachedScopeKindSchema,
  targetId: z.union([z.number(), z.string()]),
  graphKind: GraphKindSchema,
  parentNodeId: z.string(),
  fromDepth: z.number().int().min(1),
  expandToDepth: z.number().int().min(1).max(10),
})

export const AttachedFetchResultSchema = z.object({
  snapshot: GraphSnapshotSchema,
  truncatedAtDepth: z.number().int().nullable(),  // 因 lazy 限制截断的深度
  expandableNodes: z.array(z.string()),  // 可继续展开的节点
  warnings: z.array(z.string()).default([]),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  topology:build-attached:
  rate_limit: medium_query
  req: { scope, targetId, graphKind, depth, expandedNodeIds }
  resp: AttachedFetchResult
  topology:lazy-expand:
  rate_limit: medium_query
  req: LazyExpandRequest
  resp: AttachedFetchResult
  topology:add-favorite:
  rate_limit: low_freq_op
  req: { label, targetId, scope, graphKind }
  resp: { success: boolean }
  topology:remove-favorite:
  rate_limit: low_freq_op
  req: { label: string }
  resp: { success: boolean }
  topology:list-favorites:
  rate_limit: meta
  req: {}
  resp: AttachedTopologyState['pinnedFavorites']
  topology:sync-with-global:
  rate_limit: medium_query
  req: { selectedNodeId: string|null }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| targetId 不存在 | E_NOT_FOUND |
| depth > 10 | E_GRAPH_DEPTH_LIMIT |
| 节点数 > 500（即使 lazy） | E_GRAPH_NODE_LIMIT |
| graphKind 'flow' 在附属拓扑中（应使用 spec-26） | E_VALIDATION |
| 收藏 label 重复 | E_VALIDATION |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (三端均嵌入):
  given: 用户分别打开 PID=1234 / Port=3000 / WindowHandle=H 详情
  when: 检查每个面板
  then:
  - 三个详情面板都含 "关系图" Tab
  - 顶部"看图"按钮可见
  - 对应卡片含角标（badge）

GWT-2 (depth 滑块):
  given: 用户在 ProcessDetailPanel(P)，depth=3
  when: 拖到 depth=7
  then:
  - topology:build-attached 重 fetch
  - 7 层节点显示
  - depth=8 起进入 lazy 模式

GWT-3 (8-10 层 lazy):
  given: depth=10，初次 build
  when: build 默认仅展开 1-7 层
  then:
  - truncatedAtDepth === 7
  - 8 层节点 显示"+N more（双击展开）"占位
  - expandableNodes 列出该层节点 ID

GWT-4 (双击 lazy expand):
  given: 8 层有 5 个可展开节点
  when: 用户双击节点 N
  then:
  - lazy-expand fromDepth=8 expandToDepth=10
  - N 子树渲染到 10 层
  - 其他 4 个节点保持 placeholder

GWT-5 (与全局视图同步):
  given: 附属图选中节点 X
  when: 用户切到全局拓扑（spec-24）
  then: 全局图自动定位到 X 并高亮

GWT-6 (graphKind 切换):
  given: 当前 network-topology
  when: 切到 neural-relationship
  then:
  - 重 fetch；边类型变（belongs-to-project / shares-cwd 等）
  - 节点保留（共享 NodeKind）

GWT-7 (mini-thumbnail 折叠):
  given: 详情面板宽度 < 480px
  when: render
  then:
  - thumbnailMode = true
  - 仅显示缩略图 + "展开浮卡"按钮
  - 点击 → 弹 popout（R8.B spec-01 集成）

GWT-8 (收藏快捷入口):
  given: 用户在 PID=1234 的关系图
  when: 点击"固定为收藏" label='claude-code'
  then:
  - 收藏列表新增
  - 在 ActivityBar 或 favorites menu 一键回到该视图

GWT-9 (节点 > 500 拒绝):
  given: depth=10 真实数据 800 节点（即使 lazy）
  when: lazy-expand 累计超过 500
  then: E_GRAPH_NODE_LIMIT + 提示用户收敛 depth
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-25-topology-attached.spec.ts
test('GWT-1 three-end embedding', async ({ page }) => {
  await page.goto('app://./monitor/process')
  await page.click('[data-testid="process-card-PID-1234"]')
  await expect(page.locator('[data-testid="attached-topology-tab"]')).toBeVisible()
  await page.goto('app://./monitor/port')
  await page.click('[data-testid="port-card-3000"]')
  await expect(page.locator('[data-testid="attached-topology-tab"]')).toBeVisible()
  await page.goto('app://./monitor/window')
  await page.click('[data-testid="window-card-first"]')
  await expect(page.locator('[data-testid="attached-topology-tab"]')).toBeVisible()
})

test('GWT-3 8-10 lazy load', async ({ page }) => {
  await page.goto('app://./monitor/process')
  await page.click('[data-testid="process-card-PID-1234"]')
  await page.click('[data-testid="attached-topology-tab"]')
  await page.locator('[data-testid="depth-slider"]').fill('10')
  await page.waitForSelector('[data-lazy-placeholder="true"]')
  const placeholders = await page.locator('[data-lazy-placeholder="true"]').count()
  expect(placeholders).toBeGreaterThan(0)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'cytoscape@3.30':  canvas（共享 spec-21/24）
  - 'cytoscape-expand-collapse@4.x':  原生展开折叠
  - '@radix-ui/react-slider':  depth 滑块
  - 'react-resizable-panels@2.x':  响应式 < 480px 检测
inspirations:
  - "VSCode 'Show Outline' embedded panel"
  - "Process Hacker 'Properties → Modules' inline"
  - "macOS Activity Monitor 'Open Files and Ports'"
lazy_strategy:
  - depth ≤ 7: 全展开
  - 8 ≤ depth ≤ 10: 1-7 全展，8-depth 保留 placeholder + 双击 expand
  - 用户单击 expand 1 层；双击展开到当前 depth 上限
  - 总节点数累计 > 500 → 拒绝继续展开
favorites_storage:
  - %APPDATA%/devhub/topology-favorites.json
  - max 50 entries
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~750
modified_loc: ~150
test_loc: ~400
total: ~1300
risk_areas:
  - 详情面板宽度变化的响应（ResizeObserver + debounce）
  - lazy expand 的状态管理（哪些节点已展开 / 还可展开）
  - 与 spec-24 的双向同步可能引发循环 update
  - 三端入口的视觉一致性（角标位置 / 颜色）
```

---

## 10. implement_checklist

- [x] AttachedGraphView/attached panel：顶部 graphKind switcher + depth slider + 收藏按钮
- [x] LazyExpander：8-10 层节点显示 placeholder（"+N more"），双击触发 lazy-expand IPC
- [x] LazyExpansionPolicy：累计节点 > 500 拒绝；提示用户
- [x] depth 滑块默认 3，带 4 个标记点（1/3/7/10），8-10 段显示"lazy 模式"提示
- [x] AttachedHeaderButton: 顶部独立"看图"按钮，点击切到对应 Tab
- [x] CardEdgeBadge: 卡片右上角角标 "图标徽章"，hover tooltip "查看关系图"
- [x] AttachedMiniThumbnail: 宽度 < 480px 时折叠为缩略图 + 展开浮卡
- [x] AttachedNodeFavorites: 收藏管理 + 快捷入口
- [x] 与 spec-24 全局视图同步：通过 GraphService 单一 selectedNodeId 状态
- [x] feature flag `R8.C.topology.attached` 默认 ON
- [x] audit log: depth 变更 / lazy expand / 收藏 / mini 折叠
- [x] 性能：附属图 build < 800ms（depth=3，节点 ≤ 100）
- [x] vitest + playwright fixture: 3-端入口测试 / depth=10 lazy / favorites / mini

---

## 11. dependencies

```yaml
upstream:
  - spec-24: GraphService
  - spec-31: IPC 限流
  - spec-33: Zod SoT
  - R8.A spec-04: ProcessDetailPanel
  - R8.A spec-05: 三端拓扑入口
  - R8.B spec-01: popout（mini thumbnail 展开）
downstream:
  - 无（终端节点）
```

---

## 12. fallback_strategy

```yaml
on_node_limit_exceeded:
  - 自动收敛 depth，通知用户
  - 提供"切到全局视图"链接
on_data_source_partial:
  - 缺失边类型仅渲染 available 类型
  - 通知 INFO 级别
on_lazy_expand_loop:
  - 同一节点 expand 后再 collapse 再 expand → 检测到循环 → 拒绝
on_resize_thrash:
  - mini-thumbnail 切换防抖 200ms
flag_off_behavior:
  - R8.C.topology.attached=OFF → 详情面板 Tab 隐藏，仅全局视图（spec-24）可用
```

---

## 13. performance_budget

```yaml
attached_build_p95_ms: 800
attached_build_fatal_ms: 2000
lazy_expand_p95_ms: 400
depth_slider_change_p95_ms: 300
node_render_p95_ms_per_50: 50
node_total_max: 500
depth_max: 10
lazy_threshold_depth: 8
favorites_max: 50
mini_thumbnail_breakpoint_px: 480
sync_with_global_p99_ms: 50
ipc_channel: topology:build-attached → spec-31 medium_query 60 RPM
ipc_channel: topology:lazy-expand → spec-31 medium_query 60 RPM
```


---

## implementation_status_2026-05-04

### Verified Complete

- Added attached topology Zod contracts in `devhub/src/shared/schemas/attached-topology.ts` and registered them through `devhub/src/shared/schemas/r8-runtime.ts`.
- `topology:attached:get-deep10` now uses `GraphService` instead of returning a raw scanner snapshot envelope.
- Attached requests support `process`, `port`, `window`, and `project` scopes, typed `targetId`, legacy `rootId`, `network-topology` / `neural-relationship`, depth 1-10, selected node id, expanded node ids, layout, and thumbnail mode.
- Depth 8-10 uses truthful lazy behavior: the first request truncates at depth 7 and returns `E_ATTACHED_LAZY_REQUIRED`; requests with `expandedNodeIds` fetch the requested depth without claiming fake expansion.
- `AttachedGraphView` exposes graph-kind switching, a 1-10 depth slider, lazy-mode banner, pinned favorite button, mini-thumbnail breakpoint detection, and click-to-expand propagation through the R8 bridge.
- Legacy renderer fallback remains available through the existing scoped graph path when `window.devhub.r8.topology.attachedDeep10` is not available.
- Regression coverage passed the targeted spec-25 suite and the full repository Vitest suite with `--maxWorkers=1`.

### Implemented Differently From Original Sketch

- `buildScopedTopologyGraph` was not modified because pre-edit GitNexus impact reported HIGH risk across IPC and three detail consumers. The new deep10 behavior is implemented in the R8 attached bridge on top of spec-24 `GraphService`.
- Dedicated `LazyExpander`, `AttachedDepthSlider`, and favorite components were not split into separate files in this slice; the existing attached panel was upgraded in place to match current DevHub component style and avoid introducing fragmented component shells.
- Lazy expansion is request-driven and source-data-bound. The implementation does not fabricate placeholder child nodes when the real scanner-cache graph has no additional source relationships.

### Current Remaining Gaps After Later Slices

- Playwright fixture coverage for the three-card entry flow, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

### Verification Evidence

```bash
pnpm typecheck
pnpm test --run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.test.tsx src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
npx gitnexus analyze --force
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus status
```

- Targeted spec-25 suite: 4 files / 59 tests passed.
- Typecheck: passed.
- Lint and no-emoji: passed, `No emoji found in 368 files`.
- License: passed, 400 production package entries validated and 1 documented exception retained.
- Full Vitest: 75 files / 583 tests passed.
- GitNexus analyze: 4,274 nodes / 13,192 edges / 359 clusters / 300 flows.
- GitNexus impact: `R8RuntimeService` LOW risk; `setupR8RuntimeHandlers` LOW risk.
- GitNexus status: up to date for commit `de634f9`.

## 14. implementation_status_2026_05_11_attached_topology_sync

### Checked In This Pass

- Attached topology panel controls are verified in `AttachedGraphView`: graph-kind switcher, 1-10 depth slider, and local pinned favorite button.
- Depth defaults to 3, exposes the 1/3/7/10 marker text, and shows the lazy-mode banner for depth 8-10.
- `R8.C.topology.attached` is covered as a default-ON feature flag in `feature-flags.test.ts`.
- The existing runtime bridge remains verified through `topology:attached:get-deep10`: depth 10 truncates at 7 until `expandedNodeIds` is supplied, then returns the requested depth without fabricating unseen child nodes.

### Current Verification

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.test.tsx src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "attached|Attached|topology attached|feature flag|default disabled states"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub check:zod-sot
```

- Focused attached-topology/feature suite: 4 files passed, 1 skipped by test-name filter; 8 tests passed on 2026-05-11.
- Typecheck, lint/no-emoji, no-cloud-deps, no-ocr-deps, and Zod SoT gates passed on 2026-05-11.

## 15. implementation_status_2026_05_12_favorites_sync_audit

### Verified In This Pass

- `AttachedGraphView` now exposes an in-panel favorites quick-entry menu after pinning the current attached topology view, and the regression test verifies the persisted `devhub:attached-topology:favorites` entry plus visible quick-entry label.
- Depth 8-10 lazy responses now render `LazyExpander` placeholders from real `expandableNodes`; double-clicking a placeholder sends the existing typed `topology:attached:get-deep10` IPC bridge with `expandedNodeIds` and `selectedNodeId`, then clears the lazy state when the service returns the expanded graph.
- `R8RuntimeService.topologyAttachedDeep10` now rejects explicit lazy expansion results above 500 cumulative nodes with `E_GRAPH_NODE_LIMIT`, writes a refused `topology:attached-lazy-expand` audit row, and lets the existing attached panel error surface prompt the user to narrow depth or expand fewer nodes.
- Attached node selection now writes `devhub:topology:global:selected-node` and the "View selected globally" control emits `devhub:open-topology-global`; this is verified by clicking the real rendered SVG `graph-node` from the existing D3-backed `GraphCanvas`.
- The attached panel now renders a narrow-width mini-thumbnail `<details>` card with a real expanded stats card when `ResizeObserver` reports width below 480px; the regression test verifies the rendered `attached-mini-thumbnail` and `attached-mini-expanded-card`.
- `R8RuntimeService.topologyAttachedDeep10` now writes audit rows for attached depth fetches, explicit lazy expansion requests, and mini-thumbnail requests using the parsed Zod request/result payloads rather than renderer-only state.

### Verification Evidence

```powershell
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.test.tsx --maxWorkers=1 -t "topology|Topology|AttachedGraphView|attached"
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.tsx src/renderer/components/monitor/attached/AttachedGraphView.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
git -C devhub -c safe.directory='D:/Desktop/CREATOR ONE/devhub' diff --check -- src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.tsx src/renderer/components/monitor/attached/AttachedGraphView.test.tsx
```

- Focused topology suite: 2 files passed, 8 tests passed, 79 skipped by test-name filter on 2026-05-12.
- Touched-file ESLint, TypeScript `tsc --noEmit`, no-emoji, Zod SoT, and touched-file diff check passed on 2026-05-12.

### Remaining Gaps

- ActivityBar/global favorites quick-entry outside the attached panel remains open; in-panel favorites quick-entry is verified.
- Playwright fixture coverage for three-end entry, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

## 16. implementation_status_2026_05_12_attached_header_buttons

### Verified In This Pass

- Process detail now has an independent top `process-attached-topology-button` that switches the existing detail surface to the `relation-view` tab and renders the real `AttachedGraphView` for the current PID.
- Port focus now has an independent top `port-attached-topology-button` that focuses and scrolls the existing `port-attached-topology-section`, preserving the current no-tab port detail architecture while using the already embedded attached graph and flow views.
- Window view now has an independent top `window-attached-topology-button` when a real window is selected; it focuses and scrolls the existing `window-relationship-panel` with `data-graph-kind="attached"`.
- All three buttons use existing icon components from the installed icon system and carry real `data-graph-entry` / `data-graph-kind` markers; no emoji, mock graph surface, or new dependency was introduced.

### Verification Evidence

```powershell
pnpm -C devhub exec vitest run src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "attached|topology|PortFocusPanel|WindowView|ProcessDetailPanel"
pnpm -C devhub exec eslint src/renderer/components/monitor/ProcessDetailPanel.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
git -C devhub -c safe.directory='D:/Desktop/CREATOR ONE/devhub' diff --check -- src/renderer/components/monitor/ProcessDetailPanel.tsx src/renderer/components/monitor/ProcessDetailPanel.test.tsx src/renderer/components/monitor/PortFocusPanel.tsx src/renderer/components/monitor/PortFocusPanel.test.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/WindowView.test.tsx
git -c safe.directory='D:/Desktop/CREATOR ONE' diff --check -- prompts/0503-2/R8.C/spec-25-topology-attached-deep10.md .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
npx gitnexus status
```

- Focused three-end attached-header suite: 3 files passed, 6 tests passed on 2026-05-12.
- Touched-file ESLint, TypeScript `tsc --noEmit`, no-emoji, Zod SoT, touched-file diff checks, and GitNexus index status passed on 2026-05-12.

### Remaining Gaps

- ActivityBar/global favorites quick-entry outside the attached panel remains open; in-panel favorites quick-entry is verified.
- Playwright fixture coverage for three-end entry, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

## 18. implementation_status_2026_05_12_card_edge_badges

### Verified In This Pass

- A shared `CardEdgeGraphBadge` now renders a real icon button using the existing icon library, with `title="查看关系图"`, explicit `aria-label`, `data-graph-entry`, and `data-graph-kind="attached"` attributes.
- Process cards now expose `process-card-graph-badge-${pid}`. Clicking the badge stops propagation and dispatches the existing `devhub:monitor-navigate` event with a real process attached-topology scope.
- Port cards now expose `port-card-graph-badge-${port}-${pid}`. Clicking the badge stops propagation, selects the real port, focuses the `PortFocusPanel`, and switches to the existing relationship surface.
- Regular window cards and AI window cards now expose `window-card-graph-badge-${hwnd}`. Clicking the badge stops propagation, selects the real window, and focuses the existing `window-relationship-panel` attached graph surface.
- The implementation intentionally does not create mock graph data, fake panels, or a new graph surface; all entries route into existing process, port, or window attached topology paths.

### Verification Commands

```powershell
pnpm -C devhub exec vitest run src/renderer/components/monitor/MonitorCardEdgeBadge.test.tsx src/renderer/components/monitor/WindowView.test.tsx --maxWorkers=1 -t "card edge|WindowView|attached|graph badge|topology"
pnpm -C devhub exec eslint src/renderer/components/monitor/CardEdgeGraphBadge.tsx src/renderer/components/monitor/ProcessView.tsx src/renderer/components/monitor/PortView.tsx src/renderer/components/monitor/WindowView.tsx src/renderer/components/monitor/MonitorCardEdgeBadge.test.tsx src/renderer/components/monitor/WindowView.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
```

- Focused CardEdgeBadge/WindowView suite passed on 2026-05-12: 2 files, 4 tests.
- Touched-file ESLint and TypeScript `tsc --noEmit` passed on 2026-05-12.

### Remaining Gaps

- ActivityBar/global favorites quick-entry outside the attached panel remains open; in-panel favorites quick-entry is verified.
- Playwright fixture coverage for three-end entry, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

## 17. implementation_status_2026_05_12_mini_floating_card

### Verified In This Pass

- `AttachedGraphView` now keeps the existing `<480px` mini-thumbnail mode and adds a real floating expansion card through `attached-mini-popout-button`.
- The floating card is rendered as a focusable `role="dialog"` surface with real scope, target, graph-kind, node, edge, and depth data derived from the same current attached graph state.
- The mini floating card has a real close control and never fabricates graph nodes or uses placeholder data.

### Verification Evidence

```powershell
pnpm -C devhub exec vitest run src/renderer/components/monitor/attached/AttachedGraphView.test.tsx --maxWorkers=1 -t "mini|AttachedGraphView|attached"
```

- Focused attached mini-thumbnail suite: 1 file passed, 3 tests passed on 2026-05-12; stderr only contained the pre-existing empty-data warning from `NeuralGraphEngine`.

### Remaining Gaps

- ActivityBar/global favorites quick-entry outside the attached panel remains open; in-panel favorites quick-entry is verified.
- Playwright fixture coverage for three-end entry, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

## 19. implementation_status_2026_05_12_favorite_audit_bridge

### Verified In This Pass

- `attached-topology` now defines Zod SoT request/result contracts for `AttachedTopologyFavoriteChangeRequest` and `AttachedTopologyFavoriteChangeResult`; the runtime schema registry includes both names.
- `topology:attached:favorite-change` is registered as a real R8.C/spec-25 IPC channel with `R8.C.topology.attached`, wired through preload, renderer global typings, `r8RuntimeHandlers`, and `R8RuntimeService.auditAttachedTopologyFavoriteChange`.
- `AttachedGraphView` now records pin and unpin actions through `window.devhub.r8.topology.favoriteChange` after persisting the local favorites quick-entry list, including previous/next favorite counts and the current selected node id.
- `R8RuntimeService.auditAttachedTopologyFavoriteChange` writes a real `topology:attached-favorite-change` audit row with action, scope, target id, graph kind, label, counts, selected node id, and audit timestamp.
- The IPC handler regression verifies the new channel routes through the executable runtime service handler rather than falling back to a contract-only stub.

### Verification Evidence

```powershell
pnpm -C devhub exec vitest run src/renderer/components/monitor/attached/AttachedGraphView.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "AttachedGraphView spec-25 controls|topology"
pnpm -C devhub exec vitest run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "topology graph channels|handler for every R8 IPC"
pnpm -C devhub exec eslint src/shared/schemas/attached-topology.ts src/shared/schemas/r8-runtime.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/components/monitor/attached/AttachedGraphView.tsx src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
git -C devhub -c safe.directory='D:/Desktop/CREATOR ONE/devhub' diff --check -- src/shared/schemas/attached-topology.ts src/shared/schemas/r8-runtime.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/components/monitor/attached/AttachedGraphView.tsx src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.test.tsx
```

- Focused attached topology/runtime suite passed on 2026-05-12: 2 files, 5 tests, 82 skipped by test-name filter.
- Focused R8 runtime handler suite passed on 2026-05-12: 1 file, 2 tests, 20 skipped by test-name filter.
- Touched-file ESLint, TypeScript `tsc --noEmit`, Zod SoT, no-emoji, and touched-file diff check passed on 2026-05-12.

### Remaining Gaps

- ActivityBar/global favorites quick-entry outside the attached panel remains open; in-panel favorites quick-entry is verified.
- Playwright fixture coverage for three-end entry, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

## 21. implementation_status_2026_05_12_graphservice_selected_node

### Verified In This Pass

- `GraphSlice` now includes optional `selectedNodeId`, making node selection part of the shared GraphService slice contract instead of renderer-only state.
- `R8RuntimeService.topologyAttachedDeep10` forwards `selectedNodeId` into `GraphService.buildGlobal`, so attached topology and global topology share the same selected-node field in the graph snapshot slice.
- `FullScreenTopologyView` now consumes the existing session handoff only as the bootstrap source, then sends `selectedNodeId` through `window.devhub.r8.topology.network/neural/buildGlobalGraph` and focuses the matching node from `snapshot.slice.selectedNodeId`.
- Node clicks in `FullScreenTopologyView` update the same `selectedNodeId` state before reloading graph slices, keeping subsequent graph-kind, layout, scope, and time-cursor requests on the shared GraphService selection contract.

### Verification Evidence

```powershell
pnpm -C devhub exec vitest run src/main/services/graph/GraphService.test.ts src/renderer/components/topology/FullScreenTopologyView.test.tsx src/main/services/R8RuntimeService.test.ts src/renderer/components/monitor/attached/AttachedGraphView.test.tsx --maxWorkers=1 -t "GraphService|FullScreenTopologyView|attached topology depth 3 p95|AttachedGraphView spec-25 controls|topology"
pnpm -C devhub exec eslint src/shared/schemas/graph.ts src/shared/schemas/attached-topology.ts src/main/services/graph/GraphService.ts src/main/services/graph/GraphService.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/topology/FullScreenTopologyView.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx src/renderer/components/monitor/attached/AttachedGraphView.tsx src/renderer/components/monitor/attached/AttachedGraphView.test.tsx
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
```

- Focused GraphService/global/attached topology suite passed on 2026-05-12: 4 files, 15 tests, 82 skipped by test-name filter.
- Touched-file ESLint, TypeScript `tsc --noEmit`, Zod SoT, and no-emoji passed on 2026-05-12.

### Remaining Gaps

- ActivityBar/global favorites quick-entry outside the attached panel remains open; in-panel favorites quick-entry is verified.
- Playwright fixture coverage for three-end entry, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

## 20. implementation_status_2026_05_12_attached_build_performance

### Verified In This Pass

- `AttachedTopologyResult` now carries optional real `buildMs` telemetry from `R8RuntimeService.topologyAttachedDeep10`; the value is measured around the existing `GraphService.buildGlobal` call and included in the attached-depth audit target.
- Refused lazy expansion audit rows now also include `buildMs`, so oversized graph rejections keep the same timing evidence as successful attached graph builds.
- `R8RuntimeService.test.ts` now contains a depth-3 attached topology p95 performance regression using a real `R8RuntimeService` and scanner-cache fixture with 48 processes plus 48 listening ports. The test warms the path once, records 10 build samples, asserts the resulting graph stays between 10 and 100 nodes, and requires both service-call p95 and `buildMs` p95 to remain below 800ms.

### Verification Evidence

```powershell
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "attached topology depth 3 p95|topology"
```

- Focused topology/performance suite passed on 2026-05-12: 1 file, 3 tests, 82 skipped by test-name filter.

### Closure Notes

- ActivityBar/global favorites quick-entry outside the attached panel is a non-blocking design extension for a later navigation slice; the in-panel favorites quick-entry required by this spec is verified.
- The older GraphService-owned selected-node gap is superseded by `implementation_status_2026_05_12_graphservice_selected_node`.
- Playwright fixture coverage for three-end entry, depth-10 lazy behavior, favorites, and mini mode was closed on 2026-05-13 with the real Electron fixture documented below.

## 22. implementation_status_2026_05_13_playwright_fixture

### Verified In This Pass

- `devhub/e2e/example.spec.ts` now contains a real Electron Playwright fixture named `R8.C spec-25 attached topology covers real entries depth10 favorites and mini mode`.
- The fixture opens a real local TCP listener and a real Electron `BrowserWindow`, then collects actual process, port, and window candidates through `systemProcess.scan`, `port.scan`, and `windowManager.scan(false)`.
- It verifies process, port, and window attached-topology entry markers without mock data; the port path renders the real `AttachedGraphView`.
- It verifies the depth slider at `10`, lazy banner, `data-lazy="true"`, pinned favorite persistence in `devhub:attached-topology:favorites`, mini-thumbnail mode, expanded mini card, and floating mini card.
- Renderer process-tag and process-history hooks now validate IPC responses with Zod before writing state, so contract-only envelopes cannot crash the process tab while real handlers are absent.

### Verification Evidence

```powershell
pnpm -C devhub exec eslint e2e/example.spec.ts src/renderer/hooks/useProcessTag.ts src/renderer/hooks/useProcessHistory.ts
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub build
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-25 attached topology" --workers=1
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
git -C devhub -c safe.directory='D:/Desktop/CREATOR ONE/devhub' diff --check -- e2e/example.spec.ts src/renderer/hooks/useProcessTag.ts src/renderer/hooks/useProcessHistory.ts
```

- Target Playwright fixture passed on 2026-05-13: 1 test passed in 14.9s.
- Touched-file ESLint, TypeScript `tsc --noEmit`, production build, Zod SoT, no-emoji, no-cloud-deps, no-ocr-deps, and touched-file diff check passed on 2026-05-13.
- Scoped diff check emitted only the normal Windows LF-to-CRLF warning for `e2e/example.spec.ts`.

### Closure Note

- All checklist items in this spec are now checked.
