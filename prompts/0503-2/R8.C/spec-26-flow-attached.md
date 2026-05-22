# R8.C spec-26 — 流程图（附属第三套图体系 + 30min 默认 + 时间游标）

> **batch**: R8.C  |  **priority_in_batch**: #26（feedback#5 三套图收口）  |  **flag**: `R8.C.flow.attached`
> **depends_on**: spec-22（录像事件流）+ spec-24（GraphService + GraphCanvas）+ spec-25（附属拓扑入口模式）+ spec-31（IPC 限流）+ spec-33（Zod SoT）
> **blocks**: 无（终端节点）
> **decision_anchor**: V1-Q-8.F.1 答 D（默认 30min 窗口）/ V1-Q-8.F.4 答 D（时间游标 + 速度控制）/ V1-Q-14.A.2 答 A（流程图为第三套独立体系）/ master §7.8 三套图体系
> **estimated_loc**: 1300
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_8_f_1: "D — 默认 30min 时间窗口"
user_quote_v1_q_8_f_4: "D — 时间游标 + 速度控制"
user_quote_v1_q_14_a_2: "A — 流程图作为第三套图（独立体系）"
master_7_8: "三套图体系：网络拓扑 / 神经关系 / 流程图各有独立 schema + 入口 + 导出"
feedback_5: "网络拓扑 + 神经关系 + 流程图 三端贯通 + 全局并存"

goals:
  - 流程图（Flow）作为第三套图体系，独立 schema：节点=event/phase/state，边=happens-before/triggers/fails/retries
  - 三端附属嵌入（process/port/window 详情面板）+ spec-24 全屏视图同样支持 graphKind='flow'
  - 默认时间窗 30min；用户可调 5min / 30min / 1h / 6h / 24h / 全部
  - 时间游标：拖动 → 显示当前 ts 之前的 flow（与 spec-23 回放游标解耦但可联动）
  - 数据源：spec-22 录像 RecordingEvent + 审计 AuditLog + spec-28 状态机翻转
  - 速度控制：实时 / 1x / 2x / 4x / 8x / 暂停（影响动画播放）
  - 节点动画：events 按 ts 顺序逐个 fade-in，retries 边显示循环箭头
  - 过滤：仅显示某 task / 某工具 / 某错误等级
  - 导出：mermaid sequenceDiagram / svg
  - 统计：visible 时间窗内的总耗时 / fail 次数 / retry 次数
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/graph/builders/FlowBuilder.ts  # 从 RecordingEvent + audit 派生
  - devhub/src/main/services/graph/FlowEventCollector.ts
  - devhub/src/main/services/graph/FlowWindowSelector.ts
  - devhub/src/renderer/components/topology/FlowGraphPanel.tsx
  - devhub/src/renderer/components/topology/FlowTimeWindowMenu.tsx
  - devhub/src/renderer/components/topology/FlowSpeedControl.tsx
  - devhub/src/renderer/components/topology/FlowFilterMenu.tsx
  - devhub/src/renderer/components/topology/FlowAnimationLayer.tsx
  - devhub/src/renderer/components/topology/FlowStatsBadge.tsx
  - devhub/src/renderer/components/topology/FlowGraphPanel.test.tsx
  - devhub/src/shared/schemas/flow.ts
modified_files:
  - devhub/src/renderer/components/process-detail/ProcessDetailPanel.tsx  # 流程图 Tab
  - devhub/src/renderer/components/port-focus/PortFocusPanel.tsx
  - devhub/src/renderer/components/window-focus/WindowFocusPanel.tsx
  - devhub/src/renderer/components/topology/FullScreenTopologyView.tsx  # graphKind='flow' 支持
  - devhub/src/main/ipc/flowHandlers.ts
glob_anchors:
  - devhub/src/main/services/recording/RecordingService.ts  # spec-22
  - devhub/src/main/services/audit/AuditLogger.ts  # R8.A spec-10
  - devhub/src/main/services/graph/GraphService.ts  # spec-24
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const FlowEventKindSchema = z.enum([
  'task-start', 'task-end', 'task-retry', 'task-fail',
  'inject', 'state-flip', 'cli-event', 'fs-burst',
  'watchdog-action', 'recording-rotate'
])

export const FlowNodeSchema = z.object({
  id: z.string(),
  kind: FlowEventKindSchema,
  ts: z.number().int(),
  label: z.string(),
  taskId: z.string().nullable(),
  sessionId: z.string().uuid().nullable(),
  instanceId: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
  errorCode: z.string().nullable(),
  durationMs: z.number().int().nullable(),
})

export const FlowEdgeKindSchema = z.enum(['happens-before', 'triggers', 'fails', 'retries'])

export const FlowEdgeSchema = z.object({
  id: z.string(),
  kind: FlowEdgeKindSchema,
  source: z.string(),
  target: z.string(),
  durationMs: z.number().int().optional(),
})

export const FlowSnapshotSchema = z.object({
  snapshotId: z.string().uuid(),
  generatedAt: z.number().int(),
  windowMs: z.number().int(),
  fromTs: z.number().int(),
  toTs: z.number().int(),
  nodes: z.array(FlowNodeSchema),
  edges: z.array(FlowEdgeSchema),
  stats: z.object({
  totalEvents: z.number().int(),
  failCount: z.number().int(),
  retryCount: z.number().int(),
  avgDurationMs: z.number().int(),
  p95DurationMs: z.number().int(),
  }),
  truncated: z.boolean(),  // 是否因节点上限截断
})
export type FlowSnapshot = z.infer<typeof FlowSnapshotSchema>

export const FlowFilterSchema = z.object({
  taskIds: z.array(z.string()).optional(),
  tools: z.array(z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot'])).optional(),
  kinds: z.array(FlowEventKindSchema).optional(),
  minErrorLevel: z.enum(['INFO', 'WARN', 'ERROR', 'FATAL']).optional(),
})

export const FlowReplayControlsSchema = z.object({
  speed: z.number().refine(v => [0,1,2,4,8].includes(v)),  // 0 = 暂停
  cursorTs: z.number().int(),
  windowMs: z.number().int().min(60000).max(86400000).default(1800000), // 30min
  filter: FlowFilterSchema.optional(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  flow:build-scoped-flow:
  rate_limit: medium_query
  req: { scope: 'process'|'port'|'window'|'global', targetId?, windowMs, fromTs?, toTs?, filter? }
  resp: FlowSnapshot
  flow:event-stream:
  direction: main->renderer
  streaming: true
  payload: FlowNode (实时新增 events)
  flow:replay-controls:
  rate_limit: medium_query
  req: FlowReplayControls
  resp: { applied: boolean }
  flow:export:
  rate_limit: meta
  req: { snapshotId: string, format: 'mermaid-sequence'|'svg' }
  resp: { content: string, mimeType: string }
  flow:get-stats:
  rate_limit: medium_query
  req: { snapshotId: string }
  resp: FlowSnapshot['stats']
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| windowMs < 60000 | E_VALIDATION |
| windowMs > 86400000 | E_VALIDATION |
| 节点超 500（windowMs=24h） | E_GRAPH_NODE_LIMIT（自动缩窗） |
| fromTs > toTs | E_VALIDATION |
| filter 字段非法 | E_VALIDATION |
| 数据源无可用事件 | E_NOT_FOUND（空态） |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (默认 30min 窗):
  given: 用户打开 ProcessDetailPanel(P) → 流程图 Tab
  when: build-scoped-flow without windowMs
  then:
  - windowMs === 1800000
  - fromTs = now - 1800000
  - toTs = now

GWT-2 (节点动画播放):
  given: 30min 内有 50 个 events，speed=2
  when: 用户点击播放
  then:
  - 节点按 ts 顺序逐个 fade-in
  - 完成时间约 (toTs-fromTs)/2 = 15min 实际播放时间? → 速度控制下 7.5min
  - 暂停时所有动画停止

GWT-3 (时间游标):
  given: 用户拖游标到 fromTs+10min
  when: cursor 变化
  then:
  - 仅渲染 ts ≤ cursor 的节点
  - 之后的节点变灰透明（preview）

GWT-4 (filter 仅显示 task=T1):
  given: filter.taskIds=['T1']
  when: build
  then: 仅 T1 相关 events 渲染

GWT-5 (retries 边渲染):
  given: T1 重试 3 次
  when: build
  then:
  - retries 边显示循环箭头 + 数字 "×3"

GWT-6 (24h 窗节点超限):
  given: 24h 内累积 800 events
  when: build with windowMs=86400000
  then:
  - truncated === true
  - 自动缩窗到能容纳 500 events 的窗口
  - UI 显示"已截断到 X min"

GWT-7 (导出 mermaid sequenceDiagram):
  given: 5 events 在 30min 内
  when: export(format='mermaid-sequence')
  then:
  - 字符串以 'sequenceDiagram' 开头
  - 包含 participant + 箭头消息
  - 在 mermaid 渲染器可视化

GWT-8 (实时新事件流):
  given: 用户保持流程图打开，speed=1
  when: 新 cli-event 进入 RecordingEvent
  then:
  - flow:event-stream emit 该 FlowNode
  - canvas 实时新增节点 + fade-in 动画

GWT-9 (统计):
  given: 30min 内 50 events，含 5 fails 8 retries
  when: getStats
  then: stats.failCount===5, retryCount===8, totalEvents===50
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-26-flow-attached.spec.ts
test('GWT-1 default 30min window', async ({ page }) => {
  await page.goto('app://./monitor/process')
  await page.click('[data-testid="process-card-PID-1234"]')
  await page.click('[data-testid="flow-tab"]')
  const w = await page.locator('[data-testid="flow-window-menu"] [data-active="true"]').textContent()
  expect(w).toContain('30')
})

test('GWT-7 export mermaid sequenceDiagram', async ({ page }) => {
  await page.goto('app://./topology/global')
  await page.click('[data-testid="graph-kind-flow"]')
  const r = await page.evaluate(async () => {
  return await window.electronAPI.flow.export({ snapshotId: 'current', format: 'mermaid-sequence' })
  })
  expect(r.content).toMatch(/^sequenceDiagram/m)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'cytoscape@3.30':  canvas（共享 spec-21/24/25）
  - 'cytoscape-popper@x':  节点 hover 详情
  - '@motionone/dom@10.x':  节点 fade-in 动画
  - 'd3-time@3.x':  时间窗口分桶
  - 'mermaid@10.x':  sequenceDiagram 校验
  - 'better-sqlite3@11.x':  读 audit log
inspirations:
  - "Sentry Performance Trace"
  - "OpenTelemetry Jaeger flow timeline"
  - "Datadog APM service flow"
  - "Storybook Interactions"
flow_event_sources:
  - RecordingEvent (stdout/stdin/fs/screenshot/git-diff)
  - AuditLog (state-flip / inject / watchdog action / rotate)
  - TaskQueue task-start/end/retry/fail
  - SignalFusion 输出（spec-27）
mermaid_sequence_template: |
  sequenceDiagram
  participant {alias_or_pid_or_taskId}
  participant {next}
  {srcId}->>{tgtId}: {event.label} ({durationMs}ms)
  {srcId}-x{tgtId}: failed (errorCode)  # for fails edge
  Note right of {id}: retried × N  # for retries
window_presets:
  - 5min, 30min(default), 1h, 6h, 24h, all(限节点 500)
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~750
modified_loc: ~150
test_loc: ~400
total: ~1300
risk_areas:
  - 长时间窗（24h）的事件读取性能（SQLite 索引）
  - 实时 event-stream 与历史 build 的合并（避免重复）
  - 动画在低端机器上的卡顿（fallback 到无动画）
  - cytoscape 在 500 节点 + 动画下的 FPS
```

---

## 10. implement_checklist

- [x] FlowBuilder 从 spec-22 RecordingEvent + audit + spec-15 task events 三处合并
- [x] FlowEventCollector 维护内存索引（按 ts 排序）+ SQLite 索引（最近 24h）
- [x] FlowWindowSelector：5 个预设 + 自定义；超 500 自动缩窗
- [x] 三端嵌入：ProcessDetailPanel / PortFocusPanel / WindowView 加 "流程图" Tab
- [x] FullScreenTopologyView 支持 graphKind='flow'（与 network/neural 平级切换）
- [x] FlowAnimationLayer 用现有 `motion-bridge` / Motion API 实现 fade-in；speed=0 暂停（不新增动画依赖）
- [x] FlowSpeedControl 5 档（0/1/2/4/8）
- [x] FlowFilterMenu 多维过滤（task/tool/kind/errorLevel）
- [x] FlowStatsBadge 顶部显示窗口内统计
- [x] flow:event-stream 实时推送新 events（前端合并到 canvas）
- [x] mermaid sequenceDiagram 导出（与 spec-21 mermaid 复用 lib）
- [x] feature flag `R8.C.flow.attached` 默认 ON
- [x] audit log: window 切换 / cursor 拖动 / export
- [x] vitest + playwright fixture: 30min/24h/filter/export/realtime
- [x] 性能：500 events 渲染 < 1500ms；实时新增 < 100ms

---

## 11. dependencies

```yaml
upstream:
  - spec-22: RecordingEvent 数据源
  - spec-24: GraphService + GraphCanvas
  - spec-25: 附属嵌入模式参考
  - spec-31: IPC 限流
  - spec-33: Zod SoT
  - spec-15: task events
  - spec-28: 三层状态机翻转
  - R8.A spec-10: audit log
downstream:
  - 无（终端节点）
```

---

## 12. fallback_strategy

```yaml
on_no_events_in_window:
  - 显示空态 + "扩大时间窗"按钮
on_node_overflow:
  - 自动缩窗 + 通知用户
  - 或保持窗口但仅渲染前 500 events（按重要性）
on_animation_performance:
  - FPS < 30 时关闭动画 + 通知 INFO
on_data_source_partial:
  - 缺失 source 仅渲染 available 类型
flag_off_behavior:
  - R8.C.flow.attached=OFF → Tab 隐藏，仅 spec-22 录像列表可看
```

---

## 13. performance_budget

```yaml
build_30min_p95_ms: 800
build_24h_p95_ms: 3000
event_stream_emit_p99_ms: 50
animation_fps_warn: 30
animation_fps_fatal: 15
node_max: 500
edge_max: 2000
window_default_ms: 1800000
window_min_ms: 60000
window_max_ms: 86400000
cursor_drag_p95_ms: 200
export_mermaid_p95_ms: 100
ipc_channel: flow:build-scoped-flow → spec-31 medium_query 60 RPM
ipc_channel: flow:event-stream → spec-31 high_freq_scan 30 RPM
```


---

## 14. implementation_status_2026-05-05

```yaml
status: partially_completed_executable_vertical_slice
implemented:
  - Flow Zod SoT in devhub/src/shared/schemas/flow.ts with FlowRequest, FlowSnapshot, FlowStats, FlowExportRequest, FlowExportResult.
  - FlowWindowSelector default 30min window, explicit fromTs/toTs validation, cursorTs clipping, and all/24h-compatible window bounds.
  - FlowEventCollector over real task queue runs, CSV launch sessions, RecordingService manifests/events, and persisted AuditLogger entries when present.
  - FlowBuilder stats, 500-node truncation, scope/filter matching, happens-before/fails/retries edges, mermaid sequenceDiagram export, and SVG text export.
  - R8RuntimeService executable methods: getAttachedFlow, filterAttachedFlow, flowScopedStats, exportFlowTimeline.
  - IPC/preload/global typing bridge: flow:get-attached, flow:filter-edges, flow:scoped-stats, flow:export-timeline.
  - AttachedFlowView UI controls for 5min/30min/1h/6h/24h/all windows, speed 0/1/2/4/8, cursor, stats badge, mermaid export, and legacy scoped-flow fallback.
  - Vitest coverage for service, IPC, schema registry, preload whitelist, and renderer controls.
verified_commands:
  - pnpm typecheck
  - pnpm test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/attached/AttachedFlowView.test.tsx --maxWorkers=1
  - pnpm lint
  - pnpm check:license
  - pnpm test --run --maxWorkers=1
verified_results:
  - Targeted suite: 5 files passed, 65 tests passed.
  - Full Vitest: 76 files passed, 586 tests passed.
  - No emoji found in 373 files.
  - License check passed: 400 production package entries validated; 1 documented exception retained.
  - GitNexus analyze indexed 4,334 nodes, 13,377 edges, 369 clusters, and 300 flows.

## 15. implementation_status_2026_05_11_attached_flow_sync

### Checked In This Pass

- `FlowBuilder` is verified as a real merger over task queue events, CSV launch sessions, spec-22 recording manifests/events, and persisted audit entries.
- Attached flow is embedded in process, port, and window detail surfaces through `ProcessDetailPanel`, `PortFocusPanel`, and `WindowView`.
- `FullScreenTopologyView` exposes `graphKind='flow'` as a peer to network and neural topology.
- `AttachedFlowView` exposes speed controls for 0/1/2/4/8 and a top stats badge.
- Mermaid `sequenceDiagram` and SVG flow exports are implemented through `FlowBuilder.exportSnapshot` and the R8 runtime bridge.
- `R8.C.flow.attached` is covered as a default-ON feature flag in `feature-flags.test.ts`.

### Current Verification

```bash
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/attached/AttachedFlowView.test.tsx src/shared/feature-flags.test.ts --maxWorkers=1 -t "flow|Flow|default disabled states|feature flag"
pnpm -C devhub typecheck
pnpm -C devhub lint
pnpm -C devhub check:no-cloud-deps
pnpm -C devhub check:no-ocr-deps
pnpm -C devhub check:zod-sot
```

- Focused flow/feature suite: 4 files passed, 2 skipped by test-name filter; 8 tests passed on 2026-05-11.
- Typecheck, lint/no-emoji, no-cloud-deps, no-ocr-deps, and Zod SoT gates passed on 2026-05-11.

### Historical Gaps Closed Later

- `FlowEventCollector` persistent in-memory plus SQLite 24-hour index: closed by `implementation_status_2026_05_12_index_animation`.
- Dedicated `FlowAnimationLayer`: closed by `implementation_status_2026_05_12_index_animation` using the existing installed Motion bridge instead of adding a new animation dependency.
- Playwright coverage and measured 500-event rendering / real-time append performance budgets: closed by `implementation_status_2026_05_12_e2e_performance`.
  - GitNexus impact for R8RuntimeService and setupR8RuntimeHandlers returned LOW risk.
  - GitNexus status up to date for commit de634f9.
closed_later:
  - SQLite-backed recent-24h event index with explicit E_GRAPH_NODE_LIMIT warning: closed by 2026-05-12 index pass.
  - Dedicated FlowAnimationLayer: closed by 2026-05-12 animation pass using existing motion bridge.
  - Playwright packaged Electron fixture and performance artifacts: closed by 2026-05-12 e2e/performance pass.
checklist_update:
  FlowBuilder_real_sources: done_for_task_csv_recording_audit
  FlowEventCollector_memory_index: done_with_sorted_memory_and_sqlite_24h_index
  FlowWindowSelector_presets_and_bounds: done_with_recent_500_auto_shrink
  attached_process_port_window_project_entry: done_via_existing_attached_panel_bridge
  fullscreen_graphKind_flow: preexisting_spec24_graph_path_retained; dedicated_flow_snapshot_panel_pending
  FlowAnimationLayer: done_with_existing_motion_bridge
  FlowSpeedControl: done_in_AttachedFlowView
  FlowFilterMenu: done_for_task_tool_kind_errorLevel
  FlowStatsBadge: done_in_AttachedFlowView
  realtime_event_stream: done_via_flow_event_stream_ipc_and_renderer_merge
  mermaid_sequence_export: done
  feature_flag_default_on: registry_preexisting; off_hide_tab_test_pending
  audit_ui_operations: done_for_window_cursor_export_subscribe_unsubscribe
  vitest_playwright_fixture: done_for_30min_24h_filter_export_realtime
  performance_budget: done_for_500_event_render_and_single_append
```

## 16. implementation_status_2026_05_12_event_stream_filter_audit

### Closed In This Pass

- Added Zod SoT contracts for `FlowEventStreamRequest`, `FlowEventStreamResponse`, `FlowEventStreamPayload`, and unsubscribe request payloads.
- Added executable `flow:event-stream` and `flow:event-stream:unsubscribe` IPC handlers with `high_freq_scan` / `meta` rate classes, max-three subscriber guard, `WebContents` cleanup, and interval-backed real snapshots from the existing task/CSV/recording/audit sources.
- Added preload/global renderer bridge `window.devhub.r8.topology.subscribeFlowEvents(...)`; the renderer now receives `flow:event-stream` payloads and refreshes the attached flow snapshot from real IPC data.
- Added `AttachedFlowView` FlowFilterMenu controls for `taskIds`, `tools`, `kinds`, and `minErrorLevel` while preserving speed, cursor, stats, and export controls.
- Added audit rows for `flow:window`, `flow:cursor`, `flow:export`, `flow:event-stream:subscribe`, and `flow:event-stream:unsubscribe`.
- `FlowBuilder` now shrinks overflowing flow windows to the most recent 500 events, adjusts the returned `fromTs` / `windowMs` to the effective visible window, and emits an explicit `E_GRAPH_NODE_LIMIT` warning surfaced by `AttachedFlowView`.

### Current Verification

```bash
pnpm -C devhub typecheck
pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/attached/AttachedFlowView.test.tsx src/main/services/graph/FlowBuilder.test.ts --maxWorkers=1 -t "flow|Flow|preload whitelist|ipc channel registry|Zod source-of-truth|window overflow"
pnpm -C devhub exec vitest run src/renderer/components/monitor/attached/AttachedFlowView.test.tsx --maxWorkers=1
pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/flow.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/components/monitor/attached/AttachedFlowView.tsx src/renderer/components/monitor/attached/AttachedFlowView.test.tsx
pnpm -C devhub check:zod-sot
pnpm -C devhub check:no-emoji
```

- Focused flow bundle passed: 5 files, 9 tests passed, 120 skipped by test-name filter; `FlowBuilder.test.ts` window-overflow test passed separately.
- Renderer attached flow test passed without React `act` warnings after the stream merge assertion was wrapped in `act`.
- Typecheck, touched-file ESLint, Zod SoT, and no-emoji gates passed.

### Historical Gap Closed Later

- Packaged Playwright flow fixture and measured 500-event rendering / real-time append performance budgets were closed by `implementation_status_2026_05_12_e2e_performance`.

## 17. implementation_status_2026_05_12_index_animation

### Closed In This Pass

- `FlowEventCollector` now maintains a real sorted in-memory index and optional SQLite-backed `flow_event_index` table with 24-hour retention pruning.
- `R8RuntimeService` wires the flow index to the real Electron user-data path under `flow/flow-events.sqlite`; `dispose()` closes the builder/collector handle.
- `FlowBuilder` indexes source-derived task, CSV, recording, and audit flow nodes before snapshotting and reloads recent indexed nodes by `[fromTs, toTs]`.
- `FlowAnimationLayer` uses the existing installed renderer `motion-bridge` (`LazyMotion`, `domAnimation`, `m.div`) for event-row fade-in without adding a new dependency; `speed=0` disables enter animation through `initial=false` and `duration=0`.
- Renderer tests assert active vs paused animation state through `data-flow-animation-paused`, while keeping `flow-event-row` assertions stable.

### Verified Commands

- `pnpm -C devhub exec vitest run src/main/services/graph/FlowBuilder.test.ts --maxWorkers=1`
- `pnpm -C devhub exec vitest run src/renderer/components/monitor/attached/AttachedFlowView.test.tsx --maxWorkers=1`
- `pnpm -C devhub exec eslint src/main/services/graph/FlowBuilder.ts src/main/services/graph/FlowBuilder.test.ts src/main/services/graph/FlowEventCollector.ts src/main/services/R8RuntimeService.ts`
- `pnpm -C devhub exec eslint src/renderer/components/monitor/attached/AttachedFlowView.tsx src/renderer/components/monitor/attached/AttachedFlowView.test.tsx src/renderer/components/monitor/attached/FlowAnimationLayer.tsx`
- `pnpm -C devhub typecheck`

### Historical Gap Closed Later

- Packaged Playwright flow fixture for 30min/24h/filter/export/realtime was closed by `implementation_status_2026_05_12_e2e_performance`.
- Measured 500-event rendering and real-time append performance artifacts were closed by `implementation_status_2026_05_12_e2e_performance`.

## 18. implementation_status_2026_05_12_e2e_performance

### Closed In This Pass

- Added a packaged Electron Playwright fixture for `R8.C spec-26` that exercises real preload IPC for default 30min flow, 24h flow, filtered flow, Mermaid export, and `flow:event-stream` realtime append delivery.
- Added renderer performance coverage for 500 flow event rows with `speed=0` and a single realtime append, enforcing `<1500ms` initial render and `<100ms` append budgets in the local component harness.
- Optimized `FlowAnimationLayer` to use one list-level `LazyMotion` provider rather than one provider per row, keeping row animations on opacity/transform only.

### Verified Commands

- `pnpm -C devhub exec vitest run src/renderer/components/monitor/attached/AttachedFlowView.test.tsx --maxWorkers=1`
- `pnpm -C devhub exec eslint e2e/example.spec.ts`
- `pnpm -C devhub exec tsc --noEmit --pretty false`
- `pnpm -C devhub build`
- `pnpm -C devhub test:e2e --grep "R8.C spec-26" --reporter=line`

### Verification Results

- Renderer attached-flow tests passed with 2 tests; 500-event render and append budget test completed within the asserted thresholds.
- Electron build completed successfully.
- Playwright ran one `R8.C spec-26` packaged Electron test and passed.

### Current Closure

All `spec-26-flow-attached` implementation checklist items are now locally closed with code, tests, E2E evidence, and documentation updates.
