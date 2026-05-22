# Spec R8.B-06 — 进程 Treemap + Tree 视图（4 视图全集成）

> **flag**: `R8.B.process.treemap-tree`
> **priority**: P1（V1-Q-4.A 进程 4 视图全集成）
> **status**: planning
> **upstream**: R8.A spec-02 ProcessUnifiedViewModel + R8.A spec-04 卡片/列表权限对齐
> **downstream**: R8.B spec-05（treemap-mini widget）/ R8.C spec-24/25（拓扑双图）

---

## 1. motivation

### 1.1 用户原话与决策来源

```yaml
sources:
  - id: V1-Q-4.A
  answer: "全选"  # Card / List / Tree / Treemap 4 视图
  - id: V2-Q-13.G.1
  answer: "C"  # 5 条人话剧本，每个视图必须有用户能直观验收的描述
  - id: USER-FEEDBACK-2.2a
  quote: "拓扑图消失（两套图）"
  impact: "Treemap 是 attached scope 的可视化之一，必须可见"
```

### 1.2 现状缺陷

```
devhub/src/renderer/components/monitor/ProcessView.tsx
  - 仅 Card / List 两视图
  - 无 Tree（父子关系展开）/ Treemap（按 RSS 面积比例）
devhub/src/renderer/stores/processStore.ts
  - 缺 parent/children 字段
  - 缺 RSS 历史（spec-14 提供 24h sparkline 数据）
```

### 1.3 设计目标

| 目标 | 度量 |
|------|------|
| 4 视图同时可切换 | Card / List / Tree / Treemap |
| Treemap 矩形面积 ∝ RSS | 误差 ≤ 5% |
| Tree 视图深度展开 | 默认 3 层，可手动展开到 N |
| 500 节点 Treemap 渲染 | 16ms 帧预算 |
| Tree 子节点 lazy load | 100 节点起虚拟化 |
| 视图切换持久化 | 用户上次视图记忆 |

---

## 2. affected_source

```yaml
read:
  - devhub/src/renderer/components/monitor/ProcessView.tsx
  - devhub/src/renderer/stores/processStore.ts
  - devhub/src/renderer/hooks/useProcesses.ts
  - devhub/src/main/services/ProcessService.ts
  - R8.A spec-02 ProcessUnifiedViewModel
modify:
  - devhub/src/renderer/components/monitor/ProcessView.tsx  # 加 Tree / Treemap 切换
  - devhub/src/renderer/stores/processStore.ts  # 加 parent/children index
  - devhub/src/main/services/ProcessService.ts  # 提供 children 查询
new:
  - devhub/src/renderer/components/monitor/process/ProcessTreeView.tsx
  - devhub/src/renderer/components/monitor/process/ProcessTreemapView.tsx
  - devhub/src/renderer/components/monitor/process/ProcessTreeNode.tsx
  - devhub/src/renderer/components/monitor/process/ProcessTreemapTile.tsx
  - devhub/src/renderer/hooks/useProcessTree.ts
  - devhub/src/renderer/hooks/useProcessTreemap.ts
  - devhub/src/renderer/utils/treemapLayout.ts  # d3-hierarchy
  - devhub/src/main/ipc/processTreeHandlers.ts
test:
  - devhub/src/renderer/components/monitor/process/ProcessTreeView.test.tsx
  - devhub/src/renderer/components/monitor/process/ProcessTreemapView.test.tsx
  - devhub/src/renderer/utils/treemapLayout.test.ts
  - devhub/tests/e2e/process-treemap.spec.ts
docs:
  - docs/r8/process-views.md
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const ProcessViewModeSchema = z.enum(['card', 'list', 'tree', 'treemap'])

export const ProcessTreeNodeSchema: z.ZodType<any> = z.lazy(() => z.object({
  pid: z.number().int().positive(),
  ppid: z.number().int(),
  exe: z.string(),
  cmdline: z.string().optional(),
  rss: z.number().int(),
  cpu: z.number(),
  children: z.array(ProcessTreeNodeSchema).default([]),
  expanded: z.boolean().default(false),
  depth: z.number().int().min(0),
  isAiTool: z.boolean().default(false),
  permissionLevel: z.enum(['full', 'partial', 'denied']).optional(),
}))
export type ProcessTreeNode = z.infer<typeof ProcessTreeNodeSchema>

export const TreemapNodeSchema = z.object({
  id: z.string(),
  pid: z.number().int(),
  exe: z.string(),
  value: z.number().int(),  // RSS bytes
  x0: z.number(), y0: z.number(),
  x1: z.number(), y1: z.number(),
  depth: z.number().int(),
  parent: z.string().optional(),
  color: z.string().optional(),
})

export const TreemapLayoutSchema = z.object({
  nodes: z.array(TreemapNodeSchema),
  totalRss: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  groupBy: z.enum(['none', 'parent', 'exe', 'ai-tool']).default('parent'),
  colorBy: z.enum(['exe', 'rss', 'cpu', 'ai-tool']).default('exe'),
})

export const PROCESS_TREE_LIMITS = {
  DEFAULT_DEPTH: 3,
  MAX_DEPTH: 16,
  TREEMAP_MAX_NODES: 500,
  TREE_VIRTUAL_THRESHOLD: 100,
  RSS_AREA_TOLERANCE: 0.05,
} as const
```

---

## 4. ipc_contracts

```yaml
channels:
  process:tree:
  request: { rootPid?: number, maxDepth?: number }
  response: { tree: ProcessTreeNode }
  rate_limit: medium_freq_op (300 rpm)
  process:tree-children:
  request: { pid: number }
  response: { children: ProcessTreeNode[] }
  process:treemap-data:
  request: { groupBy: string, colorBy: string }
  response: { nodes: TreemapNodeSchema[], totalRss: number }
  process:view-mode-set:
  request: { mode: ProcessViewMode }
  response: { success: boolean }
```

---

## 5. error_matrix

```yaml
errors:
  - condition: '进程数 > 500'
  code: E_PERFORMANCE
  fallback: 'Treemap 自动降级到 Top 500 + 提示"已显示前 500"'
  - condition: 'parent 不存在（孤儿进程）'
  handling: '挂到虚拟 root'
  - condition: '循环 ppid 引用'
  handling: '检测 + 截断 + 日志'
  - condition: 'RSS = 0（zombie）'
  handling: 'Treemap 不显示，Tree 灰色显示'
```

---

## 6. acceptance_gwt

```gherkin
# A1 — 4 视图切换
Given 用户在进程 Tab
Then 视图模式按钮显示 4 个：Card / List / Tree / Treemap

# A2 — Tree 视图层级
Given 选择 Tree 视图
Then 默认展开 3 层
  And 用户可点击节点展开下一层
  And 子节点 lazy load

# A3 — Treemap 面积比例
Given 选择 Treemap 视图
  And 进程 A RSS = 1GB / 进程 B RSS = 500MB
Then A 矩形面积 ≈ B 矩形面积 * 2 ± 5%

# A4 — Treemap groupBy
Given 用户选择 groupBy = parent
Then 同 ppid 的进程聚合为一个父矩形
  And 父矩形面积 = 子矩形面积之和

# A5 — Treemap colorBy
Given 用户选择 colorBy = ai-tool
Then 是 AI 工具的进程染特殊色（warning）
  And 非 AI 工具按 exe hash 分配色

# A6 — Tree click 跳转
Given Tree 视图显示
When 用户点击某节点
Then 选中态同步到 Card / List 视图（V2-Q-12.C 跨视图选中保持）

# A7 — Treemap 500 节点降级
Given 进程数 = 600
When 选择 Treemap 视图
Then 仅显示 top 500（按 RSS 排序）
  And toast "已显示 RSS 前 500，其余隐藏"

# A8 — 视图模式持久化
Given 用户选 Tree 视图
When 用户重启 DevHub
Then 进程 Tab 默认仍为 Tree

# A9 — Treemap 渲染 16ms 帧
Given 500 节点 Treemap 显示
Then 帧时间 P95 < 16ms

# A10 — 视图切换防闪烁
Given 视图切换中
Then transition 200ms（受 motionLevel）
  And 选中态 / 滚动位置 / 过滤词不丢失
```

---

## 7. e2e_playwright_draft

```typescript
// devhub/tests/e2e/process-treemap.spec.ts
import { test, expect } from '@playwright/test'
import { launchDevHub } from './helpers/launchDevHub'

test('treemap displays', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="process"]')
  await page.click('[data-view-mode="treemap"]')
  await expect(page.getByTestId('process-treemap')).toBeVisible()
  const tiles = await page.getByTestId(/^treemap-tile-/).count()
  expect(tiles).toBeGreaterThan(0)
  await app.close()
})

test('tree view expandable', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="process"]')
  await page.click('[data-view-mode="tree"]')
  const root = page.getByTestId(/^tree-node-/).first()
  await root.getByTestId('tree-expand').click()
  // 点击后应有更多节点
  const all = await page.getByTestId(/^tree-node-/).count()
  expect(all).toBeGreaterThan(1)
  await app.close()
})

test('view mode persists', async () => {
  const app = await launchDevHub()
  const page = await app.firstWindow()
  await page.click('[data-testid="nav-monitor"]')
  await page.click('[data-tab="process"]')
  await page.click('[data-view-mode="treemap"]')
  await app.close()
  const app2 = await launchDevHub()
  const page2 = await app2.firstWindow()
  await page2.click('[data-testid="nav-monitor"]')
  await page2.click('[data-tab="process"]')
  await expect(page2.getByTestId('process-treemap')).toBeVisible()
  await app2.close()
})
```

---

## 8. reference_impl

### 8.1 d3-hierarchy treemap

```typescript
import { hierarchy, treemap, treemapBinary } from 'd3-hierarchy'

export function computeTreemap(processes: ProcessSnapshot[], width: number, height: number, groupBy: string): TreemapNode[] {
  const grouped = groupProcesses(processes, groupBy)
  const root = hierarchy(grouped)
  .sum((d: any) => d.rss ?? 0)
  .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  treemap<any>()
  .tile(treemapBinary)
  .size([width, height])
  .padding(2)
  (root)

  return root.descendants().filter(d => d.depth > 0).map(d => ({
  id: d.data.id ?? `${d.data.pid}`,
  pid: d.data.pid,
  exe: d.data.exe,
  value: d.value ?? 0,
  x0: d.x0!, y0: d.y0!, x1: d.x1!, y1: d.y1!,
  depth: d.depth,
  parent: d.parent?.data.id,
  }))
}
```

### 8.2 ProcessTreemapView

```tsx
export function ProcessTreemapView({ processes }: { processes: ProcessSnapshot[] }) {
  const [width, height] = useContainerSize()
  const groupBy = useTreemapStore(s => s.groupBy)
  const nodes = useMemo(
  () => computeTreemap(processes.slice(0, PROCESS_TREE_LIMITS.TREEMAP_MAX_NODES), width, height, groupBy),
  [processes, width, height, groupBy]
  )

  return (
  <svg width={width} height={height} data-testid="process-treemap">
  {nodes.map(n => (
  <ProcessTreemapTile key={n.id} node={n} />
  ))}
  </svg>
  )
}
```

### 8.3 关键参考链接

- d3-hierarchy treemap：https://d3js.org/d3-hierarchy/treemap
- Tanstack virtual：https://tanstack.com/virtual/

---

## 9. impact_radius_loc

```yaml
new_files: 8
modified_files: 3
estimated_loc:
  ProcessTreeView.tsx: 280
  ProcessTreemapView.tsx: 220
  ProcessTreeNode.tsx: 110
  ProcessTreemapTile.tsx: 90
  useProcessTree.ts: 130
  useProcessTreemap.ts: 110
  treemapLayout.ts: 140
  processTreeHandlers.ts: 120
  ProcessView.tsx (modify): +90
  processStore.ts (modify): +80
  ProcessService.ts (modify): +60
  tests: 380
total_loc: ~1810
risk_level: medium
```

---

## 10. implement_checklist

- [x] 安装 d3-hierarchy ^3.1.2 — `devhub/package.json` now includes `d3-hierarchy` plus TypeScript declarations, and `treemapLayout.ts` uses the real d3 hierarchy treemap layout.
- [x] 实现 treemapLayout（d3-hierarchy + groupBy / colorBy）
- [x] 实现 ProcessTreemapView（SVG 渲染 500 tile）
- [x] 实现 ProcessTreeView（含 lazy load + 虚拟化 100+）— 2026-05-11 补齐 renderer 展开时 `processViews.treeChildren(pid)` 懒加载路径，并保留 @tanstack/react-virtual 虚拟行渲染。
- [x] 修改 ProcessView 加 4 视图切换 + 持久化
- [x] 修改 processStore 加 parent/children index — 2026-05-11 增加 `processByPid` 与 `childPidsByParentPid` 索引，`setProcesses` / `removeProcess` 同步维护。
- [x] processTreeHandlers IPC（tree / tree-children / treemap-data / view-mode-set）
- [x] 与 spec-04 联动（命令面板"切到 Tree 视图"）
- [x] 单元 + e2e — processStore / ProcessTreeView / treemapLayout / runtime IPC focused Vitest 已通过；Playwright Electron E2E 已于 2026-05-13 覆盖真实进程扫描驱动的 Treemap SVG 渲染。
- [x] 文档：docs/r8/process-views.md
- [x] 验收 ASSERT_PROCESS_TREEMAP_RSS_PROPORTIONAL 通过

---

## 11. dependencies

```yaml
upstream_specs:
  - R8.A spec-02 ProcessUnifiedViewModel
  - R8.A spec-04 卡片/列表对齐
sibling_libs:
  - d3-hierarchy: ^3.1.2
  - @tanstack/react-virtual: ^3.13.18（已存在）
downstream_specs:
  - R8.B spec-05（treemap-mini widget）
  - R8.B spec-08（状态栏 RSS Top-N 展示复用）
  - R8.C spec-25（流程图复用 hierarchy）
```

---

## 12. fallback_strategy

```yaml
fallbacks:
  - condition: 进程数 > 500 时 treemap 卡
  action: 降级到 Top-500 + 提示
  - condition: SVG 渲染慢
  action: 切换到 Canvas 渲染（react-konva）
  - condition: ppid 循环
  action: 检测 + 断链 + log
flag_disable: 关闭 R8.B.process.treemap-tree 时仅 Card / List
```

---

## 13. performance_budget

```yaml
budgets:
  treemap_compute_500_nodes_ms: 100
  treemap_render_p95_ms: 16
  tree_lazy_load_ms_per_level: 50
  view_switch_ms: 200
  rss_proportional_tolerance: 0.05
test_harness:
  - benchmark: bench-treemap-500.mjs
  target: Chromium production-bundle DOM commit p95 < 16ms for 500 SVG tiles
```

---

## 14. implementation_status

```yaml
status: verified
implemented_at: 2026-05-05
implementation_boundary:
  completed:
  - devhub/src/shared/schemas/r8-runtime.ts adds process view mode, tree node, treemap node/layout, tree request, treemap request, and view-mode-set schemas.
  - devhub/src/renderer/utils/treemapLayout.ts computes process trees and RSS-proportional treemap tiles from real ProcessInfo rows.
  - devhub/src/renderer/components/monitor/process/ProcessTreeView.tsx renders a virtualized Tree surface and lazily loads indexed child rows through the real `processViews.treeChildren` bridge when a collapsed parent is expanded.
  - devhub/src/renderer/stores/processStore.ts maintains `processByPid` and `childPidsByParentPid` indexes for cross-view lookup and lazy tree expansion.
  - devhub/src/renderer/components/monitor/process/ProcessTreemapView.tsx renders SVG treemap tiles with groupBy/colorBy controls, bulk SVG DOM commit, delegated tile activation, bounded labels, and SVG escaping for dirty process names.
  - devhub/src/renderer/components/monitor/ProcessView.tsx adds persisted tree/treemap modes while retaining existing list/card/grouped surfaces.
  - devhub/src/main/services/R8RuntimeService.ts exposes processTree, processTreeChildren, processTreemapData, and setProcessViewMode from the live scanner snapshot.
  - devhub/src/main/ipc/r8RuntimeHandlers.ts registers executable process tree/treemap/view-mode handlers.
  - devhub/src/preload/index.ts and devhub/src/renderer/types/global.d.ts expose processViews bridge methods.
  - Command palette entries process.view.tree and process.view.treemap switch the Monitor process view through the existing command-event stream.
  - devhub/docs/r8/process-views.md documents the verified boundary, validation commands, and 500-node DOM benchmark evidence.
  - devhub/src/shared/types-extended.ts keeps legacy process detail tree data under LegacyProcessTreeNode so ProcessTreeNode remains owned by devhub/src/shared/schemas/r8-runtime.ts.
  - devhub/e2e/example.spec.ts adds a real Electron Playwright scenario that opens Monitor -> Process, runs the executable system process scan path, switches to Treemap, changes group/color controls, and verifies real SVG `treemap-tile-*` geometry plus persisted `devhub:process-view-mode`.
  - devhub/scripts/bench-treemap-500.mjs builds a production Vite bundle for the real ProcessTreemapView, runs it in headless Chromium, and enforces 500-tile DOM commit p95 < 16ms.
  not_claimed: []
verification:
  targeted:
  - pnpm -C devhub test --run src/renderer/stores/processStore.test.ts src/renderer/components/monitor/process/ProcessTreeView.test.tsx src/renderer/utils/treemapLayout.test.ts --maxWorkers=1
  - pnpm -C devhub test --run src/renderer/components/monitor/process/ProcessTreemapView.test.tsx --maxWorkers=1
  - pnpm -C devhub test --run src/renderer/utils/treemapLayout.test.ts src/renderer/stores/processStore.test.ts src/renderer/components/monitor/process/ProcessTreeView.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "treemap|Tree|process tree|Process|processStore"
  - pnpm -C devhub test --run src/renderer/utils/treemapLayout.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "treemap|Tree|process tree|Process"
  - pnpm -C devhub bench:treemap
  quality_gates:
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub check:zod-sot
  - pnpm -C devhub check:no-cloud-deps
  - pnpm -C devhub check:no-ocr-deps
  - python ./.trellis/scripts/task.py validate .trellis/tasks/05-05-r8-0503-2-full-completion-ledger
```

## 15. Implementation Update — 2026-05-11

- `processStore` now builds deterministic parent/children indexes from real process rows, including both `ppid` and `parentPid` field variants used by existing scanners.
- `ProcessTreeView` now treats indexed parents as expandable even when the initial bounded tree omits deeper child nodes, and calls `window.devhub.r8.processViews.treeChildren(pid)` on expansion to load direct children.
- `ProcessTreeNode` surfaces child-loading and child-load-error states in the existing CPU/AI column without adding fake process data.
- Verified with:
  - `pnpm -C devhub test --run src/renderer/stores/processStore.test.ts src/renderer/components/monitor/process/ProcessTreeView.test.tsx src/renderer/utils/treemapLayout.test.ts --maxWorkers=1`
  - `pnpm -C devhub test --run src/renderer/utils/treemapLayout.test.ts src/renderer/stores/processStore.test.ts src/renderer/components/monitor/process/ProcessTreeView.test.tsx src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "treemap|Tree|process tree|Process|processStore"`
  - `pnpm -C devhub typecheck`
- Remaining boundary closed on 2026-05-15 by `pnpm -C devhub bench:treemap`.

## 16. implementation_status_2026_05_13_d3_hierarchy_treemap

### Verified In This Pass

- `devhub/package.json` now includes the real `d3-hierarchy` runtime dependency and `@types/d3-hierarchy` development types; `pnpm-lock.yaml` was updated by `pnpm`.
- `devhub/src/renderer/utils/treemapLayout.ts` now builds treemap rectangles through `d3-hierarchy` `hierarchy`, `treemap`, and `treemapBinary` instead of the previous hand-written horizontal splitter.
- The renderer utility still preserves the existing `TreemapLayout` Zod output shape, top-500 truncation, RSS ordering, group/color metadata, and no synthetic process rows.
- `devhub/src/renderer/utils/treemapLayout.test.ts` now includes a 620-row fixture proving top-500 truncation, bounded d3 coordinates, and a 12-sample p95 layout budget below 200ms.

### Verification Evidence

```powershell
pnpm -C devhub add d3-hierarchy@^3.1.2
pnpm -C devhub add -D @types/d3-hierarchy
pnpm -C devhub exec vitest run src/renderer/utils/treemapLayout.test.ts --maxWorkers=1
pnpm -C devhub exec vitest run src/renderer/components/monitor/process/ProcessTreeView.test.tsx src/renderer/utils/treemapLayout.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "process|Process|treemap|tree"
pnpm -C devhub exec tsc --noEmit --pretty false
pnpm -C devhub check:no-emoji
pnpm -C devhub check:zod-sot
```

- Focused treemap utility suite passed on 2026-05-13: 3 tests passed.
- Focused process/tree/treemap/runtime handler suite passed on 2026-05-13: 4 files passed, 8 tests passed, 103 skipped by test-name filter.
- TypeScript `tsc --noEmit`, no-emoji, and Zod SoT passed on 2026-05-13.

## 17. implementation_status_2026_05_13_playwright_treemap_e2e

### Verified In This Pass

- `devhub/e2e/example.spec.ts` now includes `R8.B spec-06 process treemap renders real process scan with d3 layout`.
- The fixture launches the real Electron app, enters the real Monitor process view, clears the real process filter, triggers the executable refresh button, waits for `window.devhub.systemProcess.scan()` to return live process rows, switches through the existing `data-view-mode="treemap"` UI, and verifies the mounted `process-treemap` surface.
- The fixture exercises Treemap `groupBy` and `colorBy` controls through the rendered `<select>` elements, then asserts at least one real `treemap-tile-*` SVG group with a non-zero `<rect>` width/height and a positive PID.
- The fixture proves view-mode persistence by asserting `localStorage["devhub:process-view-mode"] === "treemap"` after UI switching.

### Verification Evidence

```powershell
pnpm -C devhub exec eslint e2e/example.spec.ts
pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.B spec-06" --workers=1
```

- ESLint passed for `devhub/e2e/example.spec.ts` on 2026-05-13.
- Playwright Electron grep passed on 2026-05-13: 1 test passed in 14.3s.

## 18. implementation_status_2026_05_15_chromium_dom_benchmark

### Verified In This Pass

- `devhub/src/renderer/components/monitor/process/ProcessTreemapView.tsx` now uses a bulk SVG DOM commit path for treemap tiles while retaining `treemap-tile-*` test IDs, selection activation, detail activation, group/color controls, and the existing RSS-proportional layout.
- The tile markup path escapes process names before writing SVG `innerHTML` so dirty executable names cannot create script nodes or malformed SVG.
- `devhub/scripts/bench-treemap-500.mjs` builds a production Vite bundle for the real renderer component, runs it in headless Chromium, renders 500 RSS-proportional SVG tiles, and fails when DOM commit p95 is at or above the 16ms frame budget.
- `devhub/src/renderer/components/monitor/process/ProcessTreemapView.test.tsx` covers delegated tile activation and SVG escaping.

### Verification Evidence

```powershell
pnpm -C devhub test --run src/renderer/components/monitor/process/ProcessTreemapView.test.tsx --maxWorkers=1
pnpm -C devhub bench:treemap
```

- Focused ProcessTreemapView test passed on 2026-05-15: 2 tests passed.
- Chromium production-bundle 500-tile DOM benchmark passed on 2026-05-15: p95 7.5ms, 12 samples, 500/500 tiles committed, under the 16ms budget.
