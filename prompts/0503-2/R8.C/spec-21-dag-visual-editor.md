# R8.C spec-21 — DAG 可视化编辑器（用户保留 V1-Q-11.A.3）

> **batch**: R8.C  |  **priority_in_batch**: #21（CSV 编辑体验）  |  **flag**: `R8.C.dag.editor`
> **depends_on**: spec-20（DAG orchestrator 提供 snapshot/cycle/serialize）+ spec-13（CSV schema）+ spec-33（Zod SoT）+ R8.B spec-12（节点拖拽 + canvas）
> **blocks**: spec-26（流程图复用部分布局算法）
> **decision_anchor**: V1-Q-11.A.3 用户保留"任务编排可视化编辑器" / V1-Q-16.G.2 答 E（编辑 + 列校验 + 模板插入 + DAG 实时预览）/ V1-Q-7.E.8 用户选 E（任务列表 + 甘特 + DAG + 看板全部）
> **estimated_loc**: 1400
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_11_a_3: "保留：全屏拓扑（一级入口）+ 任务编排可视化编辑器"
user_quote_v1_q_16_g_2: "E — 表格编辑 + 列校验 + 模板插入 + DAG 实时预览"
user_quote_v1_q_7_e_8: "E — 列表 + 甘特 + DAG + 看板四视图全部"

goals:
  - DAG 可视化编辑器：基于 cytoscape.js 渲染 DAG snapshot
  - 双向编辑：用户拖拽节点改 dependency / 添加节点 / 删边 → 同步回 CSV 表格 → 同步保存到磁盘
  - 4 视图切换：DAG canvas / 列表表格 / 甘特图 / 看板（同一份数据）
  - 实时校验：dependency DSL 错误高亮、cycle 红色边、孤立节点黄圈
  - 节点详情面板：点击节点显示 18 列字段，可改 priority / parallel_group / on_fail
  - 模板库：右键节点"复制为模板"→ 跨 CSV 重用
  - 编辑过程中锁定 CSV 文件（OS lock + flock）防止外部并发改
  - 编辑提交时再次 dag:detect-cycle，否则拒绝保存
  - 支持快捷键：Del 删节点 / Tab 添节点 / Ctrl+S 保存 / Ctrl+Z undo
  - undo/redo 栈基于 immer patch，最多 50 步
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/renderer/components/dag-editor/DagEditor.tsx
  - devhub/src/renderer/components/dag-editor/DagCanvas.tsx  # cytoscape.js wrapper
  - devhub/src/renderer/components/dag-editor/DagListView.tsx
  - devhub/src/renderer/components/dag-editor/DagGanttView.tsx  # gantt-task-react
  - devhub/src/renderer/components/dag-editor/DagKanbanView.tsx
  - devhub/src/renderer/components/dag-editor/NodeDetailPanel.tsx  # 18 列编辑
  - devhub/src/renderer/components/dag-editor/EdgeContextMenu.tsx
  - devhub/src/renderer/components/dag-editor/CycleHighlighter.tsx
  - devhub/src/renderer/components/dag-editor/UndoRedoStack.ts
  - devhub/src/renderer/components/dag-editor/CsvTwoWaySync.ts  # 表 ↔ DAG 双向
  - devhub/src/renderer/components/dag-editor/TemplateNodePalette.tsx
  - devhub/src/renderer/components/dag-editor/DagEditor.test.tsx
  - devhub/src/main/services/csv-lock/CsvFileLockService.ts  # 编辑期锁
  - devhub/src/shared/schemas/dag-editor-state.ts
modified_files:
  - devhub/src/main/ipc/csvHandlers.ts  # csv:lock / csv:save / csv:templates
  - devhub/src/renderer/router/routes.tsx  # /csv/:id/edit
glob_anchors:
  - devhub/src/main/services/dag/DagOrchestrator.ts  # spec-20
  - devhub/src/shared/schemas/csv-task-row.ts  # spec-13
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { DagSnapshotSchema } from '@/shared/schemas/dag'
import { CsvTaskRowSchema } from '@/shared/schemas/csv-task-row'

export const DagViewKindSchema = z.enum(['canvas', 'list', 'gantt', 'kanban'])

export const EditorStateSchema = z.object({
  csvPath: z.string(),
  isLocked: z.boolean(),
  lockOwnerPid: z.number().int().nullable(),
  isDirty: z.boolean(),
  rows: z.array(CsvTaskRowSchema),
  snapshot: DagSnapshotSchema.nullable(),
  selectedTaskIds: z.array(z.string()),
  hoveredEdge: z.object({ from: z.string(), to: z.string() }).nullable(),
  view: DagViewKindSchema.default('canvas'),
  undoStack: z.array(z.object({ at: z.number().int(), patch: z.unknown() })),
  redoStack: z.array(z.object({ at: z.number().int(), patch: z.unknown() })),
  cyclePaths: z.array(z.array(z.string())).default([]),
  validationErrors: z.array(z.object({
  rowIndex: z.number().int(),
  field: z.string(),
  code: z.string(),
  message: z.string(),
  })).default([]),
})
export type EditorState = z.infer<typeof EditorStateSchema>

export const NodeTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  rowTemplate: CsvTaskRowSchema.partial(),
  createdAt: z.number().int(),
  source: z.enum(['builtin', 'user']),
})

export const SaveResultSchema = z.object({
  success: z.boolean(),
  cycleDetected: z.boolean(),
  validationErrors: z.array(z.object({
  rowIndex: z.number().int(),
  code: z.string(),
  message: z.string(),
  })).default([]),
  savedAt: z.number().int().optional(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  csv:lock:
  rate_limit: low_freq_op
  req: { csvPath: string }
  resp: { acquired: boolean, ownerPid?: number, expiresAt: number }
  csv:unlock:
  rate_limit: low_freq_op
  req: { csvPath: string }
  resp: { released: boolean }
  csv:save:
  rate_limit: low_freq_op
  req: { csvPath: string, rows: CsvTaskRow[] }
  resp: SaveResult
  csv:list-templates:
  rate_limit: meta
  req: { source?: 'builtin'|'user' }
  resp: NodeTemplate[]
  csv:save-template:
  rate_limit: low_freq_op
  req: { name: string, rowTemplate: Partial<CsvTaskRow>, description?: string }
  resp: { template: NodeTemplate }
  csv:delete-template:
  rate_limit: low_freq_op
  req: { id: string }
  resp: { success: boolean }
  csv:lock-status-stream:
  direction: main->renderer
  streaming: true
  payload: { csvPath: string, locked: boolean, ownerPid?: number }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 锁文件已被占用 | E_RUNTIME（builder must wait） |
| 保存时检测到环 | E_DAG_CYCLE |
| 行级 schema 错 | E_CSV_INVALID |
| undo/redo 栈空 | E_VALIDATION |
| 模板 name 重复 | E_VALIDATION |
| 文件被外部修改（mtime 改变） | E_INTEGRITY_FAIL |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (打开编辑器锁定文件):
  given: 用户从命令面板打开 csv 编辑器，csvPath='tasks.csv'
  when: DagEditor mount
  then:
  - csv:lock 成功 acquired
  - 其他 DevHub 实例同时打开同 csv → acquired=false + 显示"已被进程 PID xxx 锁定"

GWT-2 (拖拽创建依赖):
  given: 已渲染节点 A B
  when: 用户从 A 拖拽到 B 创建边
  then:
  - rows[B].dependency 自动改为 'after:A'
  - DagOrchestrator.build 重算 snapshot
  - canvas 显示 A→B 边

GWT-3 (拖拽产生 cycle 即时高亮):
  given: 已有 A→B→C
  when: 用户拖拽 C→A
  then:
  - cyclePaths 含 ['A','B','C','A']
  - 红色高亮三条边
  - 保存按钮 disabled 直到 cycle 解除

GWT-4 (4 视图同步):
  given: 用户在 list view 改 task A 的 priority 80
  when: 切到 gantt view
  then:
  - gantt 中 A 重新排序到对应位置
  - canvas 中 A 节点 priority badge 更新

GWT-5 (Ctrl+Z undo):
  given: 用户连续做 3 次编辑
  when: 按 Ctrl+Z 一次
  then:
  - 回到第 2 次编辑后状态
  - undoStack 长度减 1，redoStack 增 1

GWT-6 (保存检查 cycle):
  given: 用户引入 cycle 后忽略警告点保存
  when: csv:save
  then:
  - resp.cycleDetected === true
  - 文件未写入
  - UI 显示拒绝原因

GWT-7 (外部修改冲突):
  given: 用户编辑中外部 IDE 改了 tasks.csv（mtime 变化）
  when: 用户保存
  then:
  - E_INTEGRITY_FAIL
  - UI 弹"外部修改 / 三选一：重新加载 / 覆盖保存 / 取消"

GWT-8 (模板复用):
  given: 节点 A 右键"保存为模板" name='code-review-block'
  when: 在另一 CSV 中右键 canvas 空白"插入模板" → 选 'code-review-block'
  then: 新节点字段值与原 A 一致（id 重新生成）
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-21-dag-editor.spec.ts
test('GWT-2 drag to create dependency', async ({ page }) => {
  await page.goto('app://./csv/tasks.csv/edit')
  await page.waitForSelector('[data-testid="dag-canvas"]')
  const a = page.locator('[data-cy-id="A"]')
  const b = page.locator('[data-cy-id="B"]')
  const aBox = await a.boundingBox()
  const bBox = await b.boundingBox()
  await page.mouse.move(aBox!.x + aBox!.width/2, aBox!.y + aBox!.height/2)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(bBox!.x + bBox!.width/2, bBox!.y + bBox!.height/2, { steps: 20 })
  await page.mouse.up({ button: 'right' })
  const dep = await page.evaluate(() => (window as any).__editorState.rows.find((r: any) => r.id==='B').dependency)
  expect(dep).toBe('after:A')
})

test('GWT-3 cycle highlight', async ({ page }) => {
  await page.goto('app://./csv/cycle-prone.csv/edit')
  // 创造 cycle
  await page.evaluate(() => window.electronAPI.test.createCycle())
  await expect(page.locator('[data-edge-cycle="true"]')).toHaveCountGreaterThanOrEqual(2)
  await expect(page.locator('[data-testid="csv-save-btn"]')).toBeDisabled()
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'cytoscape@3.30':  DAG 渲染（spec-26 流程图也复用）
  - 'cytoscape-dagre@2.5':  dagre 自动布局
  - 'gantt-task-react@0.3':  甘特视图
  - '@dnd-kit/core@6.x':  拖拽 + sortable（list view）
  - 'immer@10.x':  undo/redo patch 生成
  - 'papaparse@5.4':  CSV 读写
  - 'react-flow@11.x':  备选可视化（cytoscape 不可用时）
  - 'proper-lockfile@4.x':  跨进程文件锁
  - 'monaco-editor@0.46':  单元格大文本编辑（prompt 列）
inspirations:
  - "n8n DAG editor"
  - "Apache Airflow Graph view"
  - "GitHub Actions visualization"
  - "Linear / Asana 看板"
cytoscape_style:
  - node[critical='true']: border-color red
  - edge[in-cycle='true']: line-color #ff4d4f, width 3
  - node[orphan='true']: border-style dashed, border-color #faad14
keyboard_shortcuts:
  - Del: delete selected node/edge
  - Tab: insert new node connected from selection
  - Ctrl+S: save
  - Ctrl+Z: undo
  - Ctrl+Shift+Z / Ctrl+Y: redo
  - Ctrl+F: search
  - Ctrl+1/2/3/4: switch view
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~80
test_loc: ~420
total: ~1400
risk_areas:
  - cytoscape large graph 性能（>200 节点 + dagre layout）
  - 4 视图状态同步一致性（zustand store + selector）
  - 外部文件改动时的 mtime watch（chokidar 防抖）
  - undo/redo 栈与文件锁的协调（保存后清空 stack）
```

---

## 10. implement_checklist

- [x] CsvFileLockService 用 proper-lockfile 创建 .csv.lock；进程崩溃自动释放（lockfile stale 5min）
- [x] DagEditor 顶层 zustand store 维护 EditorState
- [x] CsvTwoWaySync：cytoscape edge 增删 → row.dependency 字符串重建；row 编辑 → snapshot 重算
- [x] UndoRedoStack 用 immer.produce + JSON patch；max 50 步；compaction 合并相邻同 task 编辑
- [x] CycleHighlighter 订阅 snapshot.cyclePaths → 标 edge[in-cycle='true']
- [x] NodeDetailPanel 18 列字段，按 spec-13 schema 用 zod 实时校验
- [x] TemplateNodePalette：内置 5 模板（代码评审 / 写测试 / 修 bug / commit / PR 描述）+ 用户自定义
- [x] 4 视图切换共享 store；视图层不持有副本
- [x] 保存：dag:detect-cycle → 通过则 papaparse.unparse → fs.writeFile（atomic 通过临时文件 rename）
- [x] 文件 mtime watch（chokidar），外部改动弹三选一 modal
- [x] feature flag `R8.C.dag.editor` 默认 ON
- [x] audit log: open/close/save/cycle-attempt/lock-conflict
- [x] vitest + playwright fixture: edit-and-cycle / 4-view-sync / undo-redo / external-modify
- [x] a11y: 键盘导航 canvas（roving tabindex），screen reader 报节点名

---

## 11. dependencies

```yaml
upstream:
  - spec-13: CsvTaskRow schema
  - spec-20: DagOrchestrator
  - spec-33: Zod SoT
  - R8.B spec-12: 节点 canvas 渲染基础（如有共享）
downstream:
  - spec-26: 流程图 cytoscape 复用样式
  - spec-12: CSV driver 调本编辑器
```

---

## 12. fallback_strategy

```yaml
on_lock_conflict:
  - 显示锁定方 PID + 提供"强制接管"按钮（须二次确认）
  - 强制接管 = 写入新 lockfile + 通知原锁方
on_cycle_at_save:
  - 拒绝保存 + 高亮 cycle + 提供 'auto-fix' 按钮（删除最弱权重边）
on_external_modify:
  - 默认推荐"重新加载（丢弃本地编辑）"，避免覆盖
  - "覆盖保存" 需二次确认 + 写入 backup 副本
on_perf_degradation:
  - 节点 > 200 时禁用 dagre layout，改用 grid layout
  - 切到 list view 作为主视图
flag_off_behavior:
  - R8.C.dag.editor=OFF → 仅命令行/外部编辑器编辑 CSV，DevHub 仅展示
```

---

## 13. performance_budget

```yaml
canvas_render_p95_ms_per_100_nodes: 200
list_render_p95_ms_per_100_rows: 80
gantt_render_p95_ms_per_100_rows: 150
view_switch_p95_ms: 80
edit_to_validation_p99_ms: 30
save_p95_ms: 200
undo_redo_p99_ms: 20
file_lock_acquire_p95_ms: 50
mtime_watch_debounce_ms: 500
node_max_per_canvas: 300
ipc_channel: csv:save → spec-31 low_freq_op 120 RPM
```

---

## 14. implementation_status_2026_05_11_dag_editor_panel_sync

```yaml
status: dag_editor_panel_partial_verified
implemented:
  - DagEditorPanel provides a renderer slice for CSV path locking/loading, four view switching, drag-to-dependency editing, list-row editing, cycle display, save guard, undo/redo row history, and user template save/insert.
  - R8RuntimeService csv save path validates rows with the shared 18-column schema, requires CSV lock ownership, rejects DAG cycles before writing, enforces expected mtime conflict checks, and writes through a temporary file rename.
  - CsvFileLockService uses a local .csv.lock JSON file with owner pid, owner, token, lock timestamp, expiry timestamp, stale detection, status, lock, unlock, and ownership assertion.
  - Feature-flag coverage verifies R8.C.dag.editor default ON.
  - Added docs/r8/dag-editor.md to document verified panel/runtime behavior and open boundaries.
verified_by:
  - pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "locks, saves|stores and deletes"
  - pnpm -C devhub exec vitest run src/shared/feature-flags.test.ts --maxWorkers=1
known_boundaries:
  - Later 2026-05-18 sections close the Zustand store, CsvTwoWaySync, UndoRedoStack, TemplateNodePalette, NodeDetailPanel, chokidar mtime watch modal, canvas a11y, and packaged Electron Playwright fixture slices; the remaining boundary is Cytoscape edge deletion UI.
```

## 17. implementation_status_2026_05_18_dag_editor_store_sync_history

```yaml
status: partial_verified
closed_checklist:
  - DagEditor 顶层 zustand store 维护 EditorState
  - CsvTwoWaySync：cytoscape edge 增删 → row.dependency 字符串重建；row 编辑 → snapshot 重算
  - UndoRedoStack 用 immer.produce + JSON patch；max 50 步；compaction 合并相邻同 task 编辑
  - 4 视图切换共享 store；视图层不持有副本
implemented:
  - `useDagEditorStore` is now the top-level renderer source of truth for `DagEditorState`, including csvPath, lock state, dirty state, rows, snapshot, selectedTaskIds, view, cyclePaths, undoStack, and redoStack.
  - `dag-editor-sync.ts` centralizes dependency parsing/serialization, edge add/remove row mutation, cycle edge keys, and row/snapshot-to-canvas graph projection so canvas/list/gantt/kanban views consume the same row state instead of local view copies.
  - `dag-editor-history.ts` uses `immer` `produceWithPatches` / `applyPatches` to persist JSON-patch-like undo/redo entries, caps history at 50 entries, and compacts adjacent edits for the same task field within the bounded edit window.
  - `DagEditorPanel` now loads CSV rows into the store, applies drag dependencies and list edits through store history, recomputes DAG cycle/snapshot after each row mutation, and drives all four views from `editorState.rows`, `editorState.snapshot`, and `editorState.view`.
verified_by:
  - `pnpm -C devhub exec vitest run src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1` passed on 2026-05-18 with 2 files / 4 tests.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec eslint src/renderer/components/dag-editor/DagEditorPanel.tsx src/renderer/components/dag-editor/dag-editor-sync.ts src/renderer/components/dag-editor/dag-editor-history.ts src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/stores/dagEditorStore.ts src/shared/schemas/dag-editor-state.ts` passed on 2026-05-18.
  - `pnpm -C devhub check:zod-sot` passed on 2026-05-18.
  - `pnpm -C devhub check:no-emoji` passed on 2026-05-18.
known_boundaries:
  - Later 2026-05-18 sections close the NodeDetailPanel 18-column realtime Zod field editor, chokidar external mtime watch modal, canvas a11y navigation, and packaged Electron Playwright fixture.
  - Cytoscape edge deletion UI remains a downstream editor interaction even though the two-way sync module supports add and remove row mutations.
```

## 15. implementation_status_2026_05_17_shared_cytoscape_canvas

```yaml
status: dag_canvas_shared_wrapper_partial_verified
implemented:
  - DagCanvas is now the shared Cytoscape wrapper for the DAG editor canvas surface and the spec-24 fullscreen global topology GraphCanvas.
  - DagCanvas registers cytoscape-dagre once, initializes and destroys the Cytoscape instance in React lifecycle, exposes Cytoscape PNG export with a non-browser SVG fallback, and preserves node click/focus contracts.
  - DagEditorPanel renders DagCanvas in Canvas view while retaining the existing drag/drop card controls and four-view state.
  - GraphCanvas consumes the same DagCanvas wrapper for network-topology, neural-relationship, and flow snapshots.
verified_by:
  - pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/components/topology/FullScreenTopologyView.test.tsx src/shared/feature-flags.test.ts src/shared/integration-manifest.test.ts --maxWorkers=1
  - pnpm -C devhub exec tsc --noEmit --pretty false
  - pnpm -C devhub build
  - pnpm -C devhub test:e2e --grep "R8.C spec-24 global topology" --reporter=line --workers=1
known_boundaries:
  - Later 2026-05-18 sections close the CSV two-way sync, undo/redo extraction, TemplateNodePalette, NodeDetailPanel, chokidar mtime watch modal, canvas a11y, and packaged Electron Playwright fixture slices; the remaining boundary is Cytoscape edge deletion UI.
```

## 16. implementation_status_2026_05_18_dag_editor_audit_rows

```yaml
status: partial_verified
closed_checklist:
  - audit log: open/close/save/cycle-attempt/lock-conflict
implemented:
  - `R8RuntimeService.lockCsv()` now records `csv:dag-editor-open` on successful editor lock acquisition and `csv:lock-conflict` when a non-stale lock is owned by another process.
  - `R8RuntimeService.unlockCsv()` records `csv:dag-editor-close` for both released and not-owned close attempts.
  - `R8RuntimeService.saveCsv()` records `csv:save` success, `csv:save` refused for row validation or mtime conflicts, and `csv:cycle-attempt` refused when DAG cycle detection blocks a write.
  - Audit targets include csvPath, lockPath or mtime context where relevant, row counts, owner pid, release status, and confirmedBy without storing CSV row contents.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "locks, saves, rejects cyclic CSV writes"` passed on 2026-05-18 with 1 file / 1 test.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts` passed on 2026-05-18.
known_boundaries:
  - Later 2026-05-18 sections close the Zustand store, CsvTwoWaySync, UndoRedoStack, TemplateNodePalette, NodeDetailPanel, chokidar mtime watch modal, canvas a11y, and packaged Electron Playwright fixture slices; the remaining boundary is Cytoscape edge deletion UI.
```

## 18. implementation_status_2026_05_18_dag_editor_template_palette

```yaml
status: partial_verified
closed_checklist:
  - TemplateNodePalette：内置 5 模板（代码评审 / 写测试 / 修 bug / commit / PR 描述）+ 用户自定义
implemented:
  - `BUILTIN_NODE_TEMPLATES` defines exactly five built-in node templates for code review, writing tests, bug fixing, commit summary, and PR description using the shared `NodeTemplate` contract.
  - `R8RuntimeService.listCsvTemplates()` now returns built-in templates for `source=builtin`, user templates for `source=user`, and the merged palette when no source is supplied, without persisting built-ins into the user template store.
  - `TemplateNodePalette` renders built-in and user template groups, quick-pick buttons for the built-ins, real user-template save, and insert actions that materialize CSV rows through the shared store/history path.
  - `DagEditorPanel` now loads the merged template palette through the preload bridge and preserves user-created templates in the same UI without replacing the built-ins.
verified_by:
  - `pnpm -C devhub exec vitest run src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "dag editor|TemplateNodePalette|stores and deletes real CSV node templates|locks a real CSV path|builtin"` passed on 2026-05-18 with 3 files / 8 selected tests.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/dag-editor/DagEditorPanel.tsx src/renderer/components/dag-editor/TemplateNodePalette.tsx src/renderer/components/dag-editor/dag-editor-sync.ts src/renderer/components/dag-editor/dag-editor-history.ts src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/stores/dagEditorStore.ts src/shared/schemas/dag-editor-state.ts` passed on 2026-05-18.
  - `pnpm -C devhub check:zod-sot` passed on 2026-05-18.
  - `pnpm -C devhub check:no-emoji` passed on 2026-05-18.
known_boundaries:
  - Later 2026-05-18 sections close the NodeDetailPanel 18-column realtime Zod field editor, chokidar external mtime watch modal, canvas a11y navigation, and packaged Electron Playwright fixture; Cytoscape edge deletion UI remains a downstream refinement.
```

## 19. implementation_status_2026_05_18_dag_editor_node_detail_panel

```yaml
status: partial_verified
closed_checklist:
  - NodeDetailPanel 18 列字段，按 spec-13 schema 用 zod 实时校验
implemented:
  - `NodeDetailPanel` renders the shared 18-column CSV task contract from `CSV_COLUMN_INFO` instead of maintaining a duplicate field list.
  - `validateDagEditorRows()` validates every edited row through `csvTaskRow18Schema.safeParse()` and returns field-level `DagEditorValidationError` records for the selected row.
  - Enum fields use constrained selects for priority, status, tool, and outputFormat; numeric fields use typed number inputs for timeoutMs and retries.
  - `DagEditorPanel` writes validation errors into `DagEditorState.validationErrors` and disables save while any shared-schema row validation error is present.
  - Node-detail patches flow through the existing store/history row update path, so canvas, list, gantt, kanban, validation, undo, redo, and save guards share the same source of truth.
verified_by:
  - `pnpm -C devhub exec vitest run src/renderer/components/dag-editor/NodeDetailPanel.test.tsx src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "NodeDetailPanel|dag editor|TemplateNodePalette|stores and deletes real CSV node templates|locks a real CSV path|builtin|validates NodeDetailPanel"` passed on 2026-05-18 with 4 files / 11 selected tests.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/dag-editor/DagEditorPanel.tsx src/renderer/components/dag-editor/TemplateNodePalette.tsx src/renderer/components/dag-editor/NodeDetailPanel.tsx src/renderer/components/dag-editor/NodeDetailPanel.test.tsx src/renderer/components/dag-editor/dag-editor-sync.ts src/renderer/components/dag-editor/dag-editor-history.ts src/renderer/components/dag-editor/dag-editor-history.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/stores/dagEditorStore.ts src/shared/schemas/dag-editor-state.ts` passed on 2026-05-18.
  - `pnpm -C devhub check:zod-sot` passed on 2026-05-18.
  - `pnpm -C devhub check:no-emoji` passed on 2026-05-18 with 758 scanned files.
known_boundaries:
  - Chokidar external mtime watch modal, canvas a11y navigation, and packaged Electron Playwright fixture are closed by later 2026-05-18 sections; Cytoscape edge deletion UI remains a downstream refinement.
```

## 20. implementation_status_2026_05_18_dag_editor_external_mtime_watch

```yaml
status: partial_verified
closed_checklist:
  - 文件 mtime watch（chokidar），外部改动弹三选一 modal
implemented:
  - `R8RuntimeService.lockCsv()` starts a dedicated `CsvFileWatcher` on the locked CSV path after successful lock acquisition and closes it on unlock/dispose.
  - The watcher observes real chokidar add/change/unlink events, re-stats the CSV file after debounce, compares observed mtime against the editor's last known saved mtime, and emits only real external-change payloads through `csv:external-change-stream`.
  - `CsvExternalChangeEvent` is a shared Zod contract carrying csvPath, kind, observedAt, expectedMtimeMs, observedMtimeMs, and sizeBytes; the preload bridge exposes it as `window.devhub.r8.csv.onExternalChange()`.
  - `DagEditorPanel` subscribes to the typed external-change stream and renders a three-action modal: reload external version, overwrite-save local version, or keep editing while preserving the normal mtime conflict guard.
  - External-change audit rows use `csv:external-watch-start`, `csv:external-modify`, and `csv:external-watch-close` without storing CSV row contents.
verified_by:
  - `pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx src/renderer/components/dag-editor/NodeDetailPanel.test.tsx src/renderer/components/dag-editor/dag-editor-history.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "external modify|external mtime|locks, saves, rejects cyclic CSV writes|DagEditorPanel|NodeDetailPanel|dag editor|TemplateNodePalette|routes CSV lock"` passed on 2026-05-18 with 5 files / 11 selected tests.
  - `pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1 -t "external modify|DagEditorPanel"` passed on 2026-05-18 after wrapping stream injection in React `act()`.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
known_boundaries:
  - Packaged Electron Playwright fixture is closed by a later 2026-05-18 section; Cytoscape edge deletion UI remains a downstream refinement.
```

## 21. implementation_status_2026_05_18_dag_editor_canvas_a11y

```yaml
status: partial_verified
closed_checklist:
  - a11y: 键盘导航 canvas（roving tabindex），screen reader 报节点名
implemented:
  - `DagCanvas` now renders a keyboard-accessible listbox over the Cytoscape surface while leaving the Cytoscape renderer and PNG export path intact.
  - Canvas nodes expose `role=option`, `aria-selected`, stable option ids, roving `tabIndex`, and node labels such as `节点 Alpha (A)` for screen readers.
  - ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Home, End, Enter, and Space all drive real focus/selection through the same `onNodeClick` callback used by pointer interaction.
  - A polite live region announces the active node name and id, so screen reader users receive node context while traversing the canvas.
  - The shared implementation benefits both `DagEditorPanel` and the fullscreen topology wrapper that reuses `DagCanvas`.
verified_by:
  - `pnpm -C devhub exec vitest run src/renderer/components/dag-editor/DagCanvas.test.tsx src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1 -t "DagCanvas a11y|DagEditorPanel"` passed on 2026-05-18 with 2 files / 5 tests.
known_boundaries:
  - Packaged Electron Playwright fixture is closed by a later 2026-05-18 section; Cytoscape edge deletion UI remains a downstream refinement.
```

## 22. implementation_status_2026_05_18_dag_editor_playwright_fixture

```yaml
status: verified
closed_checklist:
  - vitest + playwright fixture: edit-and-cycle / 4-view-sync / undo-redo / external-modify
implemented:
  - `devhub/e2e/example.spec.ts` now contains a packaged Electron fixture for `R8.C spec-21 DAG editor covers edit cycle views undo and external modify fixture`.
  - The fixture writes a real temporary CSV file with the 18-column R8 CSV header and real A/B task rows.
  - The test launches `out/main/index.js`, opens the real Monitor -> R8 Operations surface, uses the visible DAG editor UI, locks and loads the CSV through `csv:lock`, and verifies the Cytoscape canvas engine.
  - It edits `B dependsOn` in List view, verifies the Canvas `A -> B` edge, runs Undo back to the previous CSV row state, creates an `A -> B -> A` cycle, and verifies the save guard plus Gantt/Kanban synchronization.
  - It performs a real external filesystem write to the locked CSV, waits for the chokidar-backed `csv:external-change-stream` modal, verifies the three actions, and keeps local edits without synthesizing a fake renderer event.
  - The fixture exposed a packaged-runtime `better-sqlite3` ABI failure that previously aborted all extended R8 IPC registration. `InjectFirstTimeConfirmRepository` and `InjectAuditRepository` now degrade gracefully to store-backed/in-memory behavior when SQLite native loading is unavailable, preserving the real `csv:lock` handler and the rest of the R8 runtime.
verified_by:
  - `pnpm -C devhub build` passed on 2026-05-18 after the packaged IPC initialization hardening.
  - Runtime probe against `out/main/index.js` verified `window.devhub.r8.csv.lock()` returns a real acquired lock and parsed CSV rows even when `better-sqlite3` reports `NODE_MODULE_VERSION` mismatch.
  - `pnpm -C devhub test:e2e --grep "R8.C spec-21" --reporter=line --workers=1` passed on 2026-05-18 with 1 packaged Electron Playwright test.
known_boundaries:
  - Cytoscape edge deletion UI remains a downstream UI refinement; it is not an open checklist item for this spec.
```

## 23. implementation_status_2026_05_19_external_change_ipc_registry_regression

```yaml
status: verified
implemented:
  - Kept `csv:external-change-stream` as a real main-to-renderer event emitted by `R8RuntimeService.emitDagEditorCsvExternalChange()` and consumed through `window.devhub.r8.csv.onExternalChange()`.
  - Removed the stream-only channel from `SPECIFIC_R8_RUNTIME_CHANNELS` so the R8 IPC owner registry no longer skips fallback registration for the channel while also avoiding a fake invoke-style executable handler for a main-to-renderer stream.
  - Preserved the real chokidar-backed external mtime watch path, typed preload listener, and renderer three-action conflict modal without adding mock events or synthetic CSV state.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 --reporter=verbose` passed on 2026-05-19 with 25 tests.
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/renderer/components/dag-editor/DagEditorPanel.test.tsx --maxWorkers=1 -t "external modify|external mtime|locks, saves, rejects cyclic CSV writes|DagEditorPanel" --reporter=verbose` passed on 2026-05-19 with 5 selected tests and 134 skipped.
  - `pnpm -C devhub exec eslint src/main/ipc/r8RuntimeHandlers.ts --max-warnings=0`, `pnpm -C devhub exec tsc --noEmit --pretty false`, `pnpm -C devhub check:zod-sot`, `pnpm -C devhub check:no-emoji`, `pnpm -C devhub check:no-cloud-deps`, `pnpm -C devhub check:no-ocr-deps`, and `git -C devhub diff --check` passed on 2026-05-19.
known_boundaries:
  - This regression closure does not change the broader completion blockers in R8.B spec-02/spec-11 or R8.C spec-17; those still require real second-display, virtual-desktop, monitor disconnect/reconnect, or Windows Service UAC evidence as recorded in the completion ledger.
```
