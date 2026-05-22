# spec-08-monitor-window-popout — 单工具卡 popout 浮窗（subset of monitor）

> **batch**: R8.C  |  **flag**: `R8.C.monitor.popout`
> **depends_on**: R8.C spec-07, R8.B spec-01 (port-popout 系统), R8.A spec-08
> **derives_from**: V1-Q-7.B.3 答 D + R8.B port-popout 同源思路 + feedback#3 端口卡片太小

---

## 1. motivation

```yaml
user_quote_v1_q_7_b_3: "D — 独立 BrowserWindow，每个 tool 可单独 popout"
goals:
  - 监控窗的 ToolCard 一键 popout 为最小化浮窗
  - 浮窗仅显示该工具关键指标（phase + progress + confidence + 最近 1 事件）
  - 多浮窗并存（每工具最多一个）
  - 浮窗联动：双击回主监控窗
constraint:
  - 复用 R8.B.spec-01 popout 框架（PopoutWindowSchema）
  - 浮窗大小固定 320x140 默认，可调
  - 关闭浮窗不影响其他监控
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/monitor/MonitorPopoutManager.ts
  - devhub/src/renderer/monitor-popout/PopoutApp.tsx
  - devhub/src/renderer/monitor-popout/index.html
  - devhub/src/renderer/monitor-popout/index.tsx
  - devhub/src/renderer/monitor-popout/MiniToolCard.tsx
modified_files:
  - devhub/src/main/services/monitor/MonitorWindowManager.ts  # popout 控制
  - devhub/src/renderer/monitor/views/ToolCard.tsx  # popout 按钮
  - vite.config.ts  # 多入口
  - electron-builder.json
glob_anchors:
  - devhub/src/main/services/popout/PopoutManager.ts:1-200  # spec-R8.B.01 已有
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { PopoutWindowSchema } from '@/shared/schemas/popout-window'
import { ToolMonitorCardSchema } from '@/shared/schemas/monitor-snapshot'

export const MonitorPopoutSchema = PopoutWindowSchema.extend({
  popoutKind: z.literal('monitor-tool'),
  tool: z.enum(['codex','claude','gemini','cursor','copilot']),
  miniLayout: z.enum(['compact','progress-only','events-only']),
  card: ToolMonitorCardSchema,
})
export type MonitorPopout = z.infer<typeof MonitorPopoutSchema>
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  monitor:popout-open:
  req: { tool: ToolName, layout?: 'compact'|'progress-only'|'events-only' }
  resp: { popoutId: string }
  monitor:popout-close:
  req: { popoutId: string }
  monitor:popout-list:
  resp: MonitorPopout[]
  monitor:popout-snapshot-stream:
  direction: main->popout-renderer
  payload: ToolMonitorCard
  monitor:popout-return-to-main:
  req: { popoutId: string }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 同工具已有 popout | E_VALIDATION（拒绝重复） |
| popout 数 > 5 | E_RATE_LIMITED |
| 主监控窗未开 | E_NOT_FOUND（先开主监控） |
| renderer 崩溃 | (自动重启) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (popout 打开):
  given: 主监控窗 + claude 卡片激活
  when: 点击 ToolCard 的 popout 按钮
  then: 新 BrowserWindow 打开 320x140；事件流接管
  and: 主窗 ToolCard 显示 "已弹出"

GWT-2 (多 popout 共存):
  given: 已 popout claude
  when: 再 popout codex
  then: 两个浮窗并存（不冲突）

GWT-3 (返回主窗):
  given: claude popout 中
  when: 双击浮窗
  then: monitor:popout-return-to-main → 浮窗关 + 主窗高亮 claude 卡

GWT-4 (布局切换):
  given: claude popout layout=compact
  when: 用户右键切到 progress-only
  then: 立即重渲染（无重启窗口）

GWT-5 (主监控关闭):
  given: 主监控窗 + popout 都开
  when: 关主监控窗
  then: popout 仍运行 + 状态正确（事件流不依赖主监控）
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 popout claude card', async ({ electronApp }) => {
  await electronApp.evaluate(({ ipcMain }) => ipcMain.handle('monitor:open'))
  const popoutId = await electronApp.evaluate(({ ipcMain }) => ipcMain.handle('monitor:popout-open', { tool: 'claude' }))
  const popout = await electronApp.windowByTitle(/Claude.*Monitor/)
  expect(popout).toBeTruthy()
  await popout.waitForSelector('[data-tool="claude"][data-layout="compact"]')
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'electron@33.x':  BrowserWindow.popout
  - 'react@18 + jotai@2':  renderer
  - 'tailwindcss@3.4':  紧凑样式
inspirations:
  - macOS Picture-in-Picture
  - YouTube floating player
  - VSCode "Editor: Float" command
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~480
modified_loc: ~120
test_loc: ~250
total: ~850
risk_areas:
  - 主窗关闭时事件流路由变更
  - popout 数量上限和资源消耗
```

---

## 10. implement_checklist

- [x] 复用 R8.B PopoutManager（同框架）
- [x] 默认 320x140，最小 200x100
- [x] 5 popout 上限（防资源滥用）
- [x] 双击返回主窗（不关 popout 也可）
- [x] 右键菜单切换 layout（compact / progress-only / events-only）
- [x] popout 独立 preload + 最小权限 IPC subset
- [x] 主窗关闭后 popout 独立运行（事件流走 main 进程直推）
- [x] vitest + Playwright 5 GWT
- [x] feature flag R8.C.monitor.popout 默认 ON
- [x] audit log: popout 打开/关闭

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-07: monitor 主窗 + ToolCard
  - R8.B.spec-01: PopoutManager 框架
  - R8.A.spec-08: always-on-top
downstream:
  - R8.C.spec-32: 观测仪表盘可调用 popout
```

---

## 12. fallback_strategy

```yaml
on_popout_overflow:
  - 提示用户关闭旧 popout
on_main_monitor_closed:
  - popout 仍运行 + 重连主进程事件流
flag_off_behavior:
  - R8.C.monitor.popout=OFF 时主监控窗 popout 按钮隐藏
```

---

## 13. performance_budget

```yaml
popout_open_ms: { warn: 600, fatal: 2500 }
popout_max_count: 5
memory_per_popout_mb: { warn: 30, fatal: 100 }
fps: { warn_below: 30, fatal_below: 15 }
ipc_channel: monitor:popout-snapshot-stream → spec-31 high_freq_scan 30 RPM
```

---

## 14. implementation_evidence_2026-05-04

```yaml
status: partial_verified_executable_monitor_tool_popout_bridge
implemented:
  - shared_zod_contracts:
  - MonitorPopout
  - MonitorPopoutLayout
  - executable_ipc:
  - monitor:popout-open
  - monitor:popout-close
  - monitor:popout-list
  - monitor:popout-return-to-main
  - popout_constraints:
  per_tool_limit: 1
  total_limit: 5
  default_bounds: 320x140
  layouts: [compact, progress-only, events-only]
  - bridge_reuse:
  mechanism: existing R8.B BrowserWindow popout bridge
  surface: monitor
  targetId: tool_name
  - return_to_main:
  closes_popout: true
  focuses_existing_monitor_window_when_present: true
verified:
  - targeted_vitest: 3 files / 39 tests passed
  - typecheck: passed
  - lint: passed
  - no_emoji: passed over 279 files
  - full_vitest: 56 files / 494 tests passed with --maxWorkers=1
  - license: passed
  - gitnexus: R8RuntimeService LOW risk; setupR8RuntimeHandlers LOW risk
closed_by_later_evidence:
  - dedicated monitor-popout renderer entry: closed by 2026-05-14 dedicated electron-vite monitor-popout entry
  - monitor:popout-snapshot-stream push loop: closed by 2026-05-13 stream survival evidence and 2026-05-14 packaged E2E
  - independent popout preload subset: closed by 2026-05-14 out/preload/monitor-popout.cjs
  - Playwright Electron GWT coverage: closed by 2026-05-14 packaged spec-08 and spec-07/spec-08 regression E2E
  - audit-log rows for popout open/close: closed by executable monitor:popout-open and monitor:popout-close runtime paths
notes:
  - monitor:popout-open refuses to create tool popouts until the main monitor BrowserWindow is live.
  - Duplicate tool popouts fail with E_VALIDATION instead of silently reusing or faking success.
```

## 18. implementation_evidence_2026-05-14_packaged_playwright_gwt

```yaml
status: verified_packaged_playwright_gwt_and_dedicated_preload
implemented:
  - dedicated_monitor_popout_build_entries:
  files:
  - devhub/electron.vite.config.ts
  - devhub/src/renderer/monitor-popout.html
  - devhub/src/renderer/monitor-popout.tsx
  - devhub/src/preload/monitor-popout.ts
  behavior:
  - electron-vite builds out/renderer/monitor-popout.html for monitor tool popout BrowserWindows
  - electron-vite builds out/preload/monitor-popout.cjs as an independent monitor-only preload
  - R8RuntimeService loads the dedicated renderer and preload only for surface=monitor tool popouts
  - minimum_permission_preload_subset:
  file: devhub/src/preload/monitor-popout.ts
  exposed_namespace: window.devhub.r8.monitor
  allowed_methods:
  - snapshot
  - focusInstance
  - closePopout
  - listPopouts
  - returnPopoutToMain
  - setPopoutLayout
  - onPopoutSnapshotStream
  denied_namespaces:
  - window.devhub.projects
  - window.devhub.systemProcess
  - window.devhub.r8.popout
  - window.devhub.r8.cli
  - packaged_electron_gwt:
  file: devhub/e2e/example.spec.ts
  test: R8.C spec-08 monitor tool popouts cover packaged five-GWT layout return and stream survival
  coverage:
  - opens the real main monitor BrowserWindow first
  - opens claude and codex tool popouts as independent BrowserWindows
  - verifies independent target query routing and dedicated monitor-popout renderer surface
  - verifies the packaged tool popout exposes only window.devhub.r8.monitor and denies project/systemProcess/r8.popout/r8.cli APIs
  - verifies out/preload/monitor-popout.cjs and out/renderer/monitor-popout.html exist after production build
  - switches claude layout to events-only through the real renderer menu and IPC
  - double-clicks claude back to the main monitor and verifies codex remains live
  - closes the main monitor BrowserWindow and verifies codex still receives monitor:popout-snapshot-stream
  - verifies externally triggered progress-only layout state is reflected in the tool popout UI
  - packaged_preload_path:
  file: devhub/src/main/services/R8RuntimeService.ts
  behavior: monitor popout BrowserWindows load the packaged out/preload/index.cjs bridge, restoring window.devhub.r8 inside popouts
  - popout_stream_layout_sync:
  file: devhub/src/renderer/components/monitor/R8OpsPanel.tsx
  behavior: monitor:popout-snapshot-stream refreshes monitor popout metadata so external layout changes update active tool cards
  - packaged_splash_lifecycle:
  file: devhub/src/renderer/main.tsx
  behavior: renderer bundle removes pre-react splash after React commit so strict popout CSP does not leave a blocking overlay
verified:
  - command: pnpm -C devhub exec eslint e2e/example.spec.ts src/renderer/main.tsx src/main/services/R8RuntimeService.ts src/renderer/components/monitor/R8OpsPanel.tsx
  result: passed
  - command: pnpm -C devhub exec tsc --noEmit --pretty false
  result: passed
  - command: pnpm -C devhub build
  result: passed with existing Monaco dynamic/static import warning
  - command: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-0[78]" --workers=1 --reporter=line
  result: 2 passed, including spec-07 and spec-08 packaged Electron GWT
  - command: pnpm -C devhub exec eslint src/preload/monitor-popout.ts src/renderer/monitor-popout.tsx src/renderer/components/monitor/MonitorWindowCards.tsx src/main/services/R8RuntimeService.ts e2e/example.spec.ts
  result: passed
  - command: pnpm -C devhub exec tsc --noEmit --pretty false
  result: passed
  - command: pnpm -C devhub build
  result: passed and emitted out/preload/monitor-popout.cjs plus out/renderer/monitor-popout.html; existing Monaco dynamic/static import warning remains non-fatal
  - command: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-08" --workers=1 --reporter=line
  result: 1 passed
  - command: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-0[78]" --workers=1 --reporter=line
  result: 2 passed
  - command: pnpm -C devhub check:no-emoji
  result: No emoji found in 608 files
closed_boundaries:
  - dedicated monitor-popout renderer build entry
  - dedicated independent preload file
```

## 15. implementation_evidence_2026-05-08

```yaml
status: partial_verified_popout_stream_and_renderer_entry
implemented:
  - bridge_reuse:
  file: devhub/src/main/services/R8RuntimeService.ts
  mechanism: existing R8.B BrowserWindow popout bridge
  no_new_window_subsystem: true
  - sizing_and_limits:
  default_bounds: 320x140
  min_bounds: 200x100
  effective_max_tool_popouts: 5
  enforcement:
  - only five MonitorTool enum values exist
  - duplicate same-tool popouts fail with E_VALIDATION
  - executable_preload_subset:
  file: devhub/src/preload/index.ts
  methods:
  - window.devhub.r8.monitor.openPopout
  - window.devhub.r8.monitor.closePopout
  - window.devhub.r8.monitor.listPopouts
  - window.devhub.r8.monitor.returnPopoutToMain
  - window.devhub.r8.monitor.setPopoutLayout
  - window.devhub.r8.monitor.onPopoutSnapshotStream
  whitelist_doc: prompts/0421/contracts/23-ipc-contracts-master.md
  - popout_stream:
  channel: monitor:popout-snapshot-stream
  payload: ToolMonitorCard
  source: same real MonitorSnapshot cards as monitor:snapshot-stream
  routing: live monitor tool BrowserWindow only
  - renderer_entry:
  files:
  - devhub/src/renderer/components/monitor/MonitorWindowCards.tsx
  - devhub/src/renderer/components/monitor/R8OpsPanel.tsx
  details:
  - main monitor cards expose an explicit popout button
  - active popout tools show the "已弹出" state
  - monitor tool popout route renders only its target tool card
  - double-clicking the single-tool card calls monitor:popout-return-to-main
  - right-clicking or activating the layout button opens an accessible menu for compact / progress-only / events-only
  - events-only layout hides the progress bar and renders the bounded real event panel
  - audit:
  actions:
  - monitor:popout-open
  - monitor:popout-close
  - monitor:popout-layout-set
  result: success rows written through AuditLogger
  - feature_flag:
  name: R8.C.monitor.popout
  default: ON through shared feature flag registry
verified:
  - command: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx --testNamePattern "monitor|Monitor|popout|Popout|preload|snapshot|confidence" --maxWorkers=1
  result: 4 files / 22 tests passed / 68 skipped by filter
  - command: pnpm -C devhub typecheck
  result: passed
  - command: pnpm -C devhub lint
  result: passed, including check:no-emoji over 580 files
  - command: pnpm -C devhub check:zod-sot
  result: passed
  - gitnexus_impact:
  openMonitorPopout: LOW
  closeMonitorPopout: LOW
  listMonitorPopouts: LOW
  returnMonitorPopoutToMain: LOW
  setMonitorPopoutLayout: LOW
closed_by_later_evidence:
  - dedicated monitor-popout renderer build entry: closed by 2026-05-14 out/renderer/monitor-popout.html build evidence
  - dedicated independent preload file: closed by 2026-05-14 out/preload/monitor-popout.cjs build evidence
  - packaged Electron Playwright 5 GWT suite: closed by 2026-05-14 spec-08 packaged E2E
  - packaged main-monitor-close survival E2E: closed by 2026-05-14 spec-08 packaged E2E
```

## 16. implementation_evidence_2026-05-13_right_click_layout

```yaml
status: partial_verified_right_click_layout_switching
implemented:
  - runtime_persistence:
  file: devhub/src/main/services/R8RuntimeService.ts
  method: setMonitorPopoutLayoutPreference
  behavior:
  - validates existing live monitor tool popout before mutation
  - persists miniLayout through monitorPopoutLayouts electron-store key
  - reuses real listMonitorPopouts snapshot conversion after update
  - writes monitor:popout-layout-set audit row
  - ipc_and_preload:
  files:
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  channel: monitor:popout-set-layout
  bridge: window.devhub.r8.monitor.setPopoutLayout
  whitelist_docs:
  - prompts/0421/contracts/23-ipc-contracts-master.md
  - prompts/0503-2/_shared/ipc-channels.md
  - renderer_interaction:
  files:
  - devhub/src/renderer/components/monitor/MonitorWindowCards.tsx
  - devhub/src/renderer/components/monitor/R8OpsPanel.tsx
  details:
  - popout card onContextMenu opens the same accessible role=menu as the explicit layout button
  - menu options are compact / progress-only / events-only
  - Escape and outside click close the menu
  - selected layout is read from real monitor popout state and sent through IPC, not local-only UI state
  - events-only mode hides the progressbar and renders the event panel from real ToolMonitorCard.recentEvents
verified:
  - command: pnpm -C devhub exec eslint src/shared/schemas/r8-runtime.ts src/main/ipc/r8RuntimeHandlers.ts src/main/ipc/r8RuntimeHandlers.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/preload/index.ts src/preload/preloadContract.test.ts src/renderer/types/global.d.ts src/renderer/components/monitor/MonitorWindowCards.tsx src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/R8OpsPanel.tsx src/renderer/components/monitor/R8OpsPanel.test.tsx
  result: passed
  - command: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/R8OpsPanel.test.tsx --maxWorkers=1 -t "monitor|Monitor|popout|Popout|preload"
  result: 5 files passed, 28 tests passed, 92 skipped by filter
  - command: pnpm -C devhub exec tsc --noEmit --pretty false
  result: passed
  - command: pnpm -C devhub check:no-emoji
  result: No emoji found in 606 files
closed_by_later_evidence:
  - dedicated monitor-popout renderer build entry: closed by 2026-05-14 dedicated renderer entry
  - dedicated independent preload file: closed by 2026-05-14 dedicated preload subset
  - packaged Electron Playwright 5 GWT suite: closed by 2026-05-14 spec-08 packaged E2E
  - explicit main-monitor-close survival proof: closed by 2026-05-14 main-monitor-close stream survival assertion
```

## 17. implementation_evidence_2026-05-13_main_monitor_close_stream

```yaml
status: partial_verified_tool_popout_stream_survives_main_monitor_close
implemented:
  - main_process_stream_fix:
  file: devhub/src/main/services/R8RuntimeService.ts
  method: emitMonitorSnapshotStream
  root_cause: monitor:popout-snapshot-stream was emitted only after monitor:snapshot-stream targets existed
  behavior:
  - detects live monitor tool popout targets even when the main monitor BrowserWindow is closed
  - still avoids snapshot work when no monitor stream target and no live tool popout target exist
  - keeps monitor:popout-snapshot-stream payload sourced from real monitorSnapshot ToolMonitorCard data
  - regression_test:
  file: devhub/src/main/services/R8RuntimeService.test.ts
  scenario:
  - open real R8 monitor BrowserWindow through existing popout bridge
  - open claude monitor tool popout
  - close only the main monitor BrowserWindow
  - parse a real CLI chunk through parseCliChunk
  - advance the real throttle path and assert the tool BrowserWindow receives monitor:popout-snapshot-stream
verified:
  - command: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "keeps monitor tool popout streams alive"
  result: 1 passed, 86 skipped by filter
  - command: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/R8OpsPanel.test.tsx --maxWorkers=1 -t "monitor|Monitor|popout|Popout|preload"
  result: 5 files passed, 28 tests passed, 92 skipped by filter
  - command: pnpm -C devhub exec tsc --noEmit --pretty false
  result: passed
  - command: pnpm -C devhub check:no-emoji
  result: No emoji found in 606 files
closed_by_later_evidence:
  - dedicated monitor-popout renderer build entry: closed by 2026-05-14 dedicated renderer entry
  - dedicated independent preload file: closed by 2026-05-14 dedicated preload subset
  - packaged Electron Playwright 5 GWT suite: closed by 2026-05-14 packaged spec-08 and spec-07/spec-08 E2E
```
