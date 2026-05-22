# spec-07-monitor-window — AI 监控独立窗口（5 工具实时面板）

> **batch**: R8.C  |  **flag**: `R8.C.monitor.window`
> **depends_on**: R8.C spec-01..06, R8.A spec-08 (window-always-on-top)
> **derives_from**: V1-Q-7.B.3 答 D 独立 BrowserWindow 监控 + feedback#4 监控不够好

---

## 1. motivation

```yaml
user_quote_v1_q_7_b_3: "D — 独立 BrowserWindow（弹出式监控窗口）"
feedback_4: "监控进度迟报漏报；6 信号 8 阶段硬编码错误"
goals:
  - 独立 BrowserWindow（不嵌入主窗，避免被 Tab 切走时停更新）
  - 显示 5 工具实时状态：phase / progress / confidence / tokens / cost
  - 订阅 spec-01 cli:event-stream + spec-27 fusion 信号
  - 进度数据点必含 source ∈ {cli-real, heuristic, fusion} + confidence
  - 支持 always-on-top + 透明度调节
constraint:
  - 不阻塞主窗（独立 renderer 进程）
  - 关闭时不影响检测（后台仍跑）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/monitor/MonitorWindowManager.ts
  - devhub/src/main/services/monitor/MonitorState.ts
  - devhub/src/renderer/monitor/MonitorApp.tsx
  - devhub/src/renderer/monitor/index.html
  - devhub/src/renderer/monitor/index.tsx
  - devhub/src/renderer/monitor/views/ToolCard.tsx
  - devhub/src/renderer/monitor/views/ProgressBar.tsx
  - devhub/src/renderer/monitor/views/ConfidenceBadge.tsx
  - devhub/src/renderer/monitor/views/TokenCounter.tsx
  - devhub/src/shared/schemas/monitor-snapshot.ts
modified_files:
  - devhub/src/main/index.ts  # 注册新窗口路由
  - devhub/src/preload/monitor.ts  # 单独 preload
  - electron-builder.json  # 打包多 renderer entry
  - vite.config.ts  # 多入口
glob_anchors:
  - devhub/src/main/index.ts:1-150
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { ProgressDataPointSchema } from '@/shared/schemas/progress-data-point'
import { CliEventSchema } from '@/shared/schemas/cli-event'

export const ToolMonitorCardSchema = z.object({
  tool: z.enum(['codex','claude','gemini','cursor','copilot']),
  active: z.boolean(),
  instanceCount: z.number().int().nonnegative(),
  currentPhase: z.enum(['idle','thinking','tool-use','editing','running','completed','error']),
  progress: ProgressDataPointSchema.nullable(),
  tokens: z.object({
  input: z.number().int().nonnegative(),
  output: z.number().int().nonnegative(),
  }).nullable(),
  costUsd: z.number().nonnegative().nullable(),
  lastEventAt: z.number().int().nullable(),
  recentEvents: z.array(CliEventSchema).max(20),
})

export const MonitorSnapshotSchema = z.object({
  cards: z.array(ToolMonitorCardSchema),
  windowState: z.object({
  alwaysOnTop: z.boolean(),
  opacity: z.number().min(0.3).max(1),
  bounds: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  }),
  collectedAt: z.number().int(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  monitor:open:
  req: {}
  resp: { windowId: number }
  monitor:close: {}
  monitor:snapshot:
  req: {}
  resp: MonitorSnapshot
  monitor:snapshot-stream:  # 推送：100ms throttle
  direction: main->monitor-renderer
  payload: MonitorSnapshot
  monitor:set-window-prefs:
  req: { alwaysOnTop?, opacity?, bounds? }
  resp: { success: boolean }
  monitor:focus-instance:  # 用户在监控点工具卡 → 主窗聚焦实例
  req: { tool, instanceId }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| BrowserWindow 创建失败 | E_INTERNAL |
| preload script 加载失败 | E_INTERNAL（监控失效，但不影响主窗） |
| snapshot-stream 节流溢出 | E_RATE_LIMITED |
| renderer 崩溃 | (主进程自动重启监控窗) |
| 主窗关闭但监控开着 | (允许独立运行) |

---

## 6. acceptance_gwt

```yaml
GWT-1 (打开监控窗):
  given: 主窗已运行
  when: 用户菜单点击"打开监控窗" / IPC monitor:open
  then: 新 BrowserWindow 打开 + 显示 5 工具卡

GWT-2 (实时更新):
  given: 监控窗打开 + claude 实例在跑
  when: ClaudeParser 发出 progress 事件
  then: monitor:snapshot-stream 100ms 内推送 + UI 进度条更新

GWT-3 (置信度可见):
  given: 信号融合输出 confidence=0.65
  when: monitor 渲染
  then: ConfidenceBadge 显示 "65%" + 颜色 yellow（< 0.7）

GWT-4 (always-on-top):
  given: 用户开启 always-on-top
  when: 切换其他应用
  then: 监控窗保持最前；主窗不影响

GWT-5 (主窗关闭独立运行):
  given: 监控窗 + 主窗均开
  when: 用户关闭主窗
  then: 监控窗仍运行 + 后台 cli-parser 仍工作 + 关闭监控窗才退出
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 monitor open + GWT-2 realtime update', async ({ electronApp }) => {
  const winId = await electronApp.evaluate(({ ipcMain }) => ipcMain.handle('monitor:open'))
  const monitor = await electronApp.windowByTitle('DevHub Monitor')
  expect(monitor).toBeTruthy()
  await monitor.waitForSelector('[data-tool="claude"]')
  await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.emit('test:simulate-claude-progress', { instanceId: 'cl-1', pct: 42, confidence: 0.8 })
  })
  await monitor.waitForFunction(() => document.querySelector('[data-tool="claude"] [role=progressbar]')?.getAttribute('aria-valuenow') === '42')
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'electron@33.x':  BrowserWindow + IPC
  - 'react@18 + jotai@2':  renderer state
  - 'recharts@2.13':  progress / token 折线图
  - 'framer-motion@11':  confidence 颜色过渡（feedback#1 主题动效维度）
inspirations:
  - Activity Monitor / Task Manager
  - htop / ctop (容器监控)
  - Anthropic Workbench latency view
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~150
test_loc: ~400
total: ~1450
risk_areas:
  - vite 多入口配置易出错
  - preload 路径硬编码
  - 主窗关闭后窗口生命周期管理
```

---

## 10. implement_checklist

- [x] BrowserWindow 配置：transparent / vibrancy / resizable
- [x] preload 注入 electronAPI.monitor 子集（最小权限）
- [x] snapshot-stream 100ms throttle
- [x] ToolCard 5 个；onClick → focus-instance
- [x] ConfidenceBadge: <0.5 红, 0.5-0.7 黄, 0.7-0.9 蓝, >0.9 绿
- [x] always-on-top + opacity slider 写 store
- [x] 主窗关闭独立运行（lifecycle 处理）
- [x] 主题 4 维同步（feedback#1：palette/density/radius/motion）
- [x] vitest + Playwright 5 GWT
- [x] feature flag R8.C.monitor.window 默认 ON
- [x] 审计：每次打开/关闭写 audit log

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-01..06: parser + detection
  - R8.A.spec-08: WindowManager always-on-top
  - R8.A.spec-06: theme 4D axis（同步样式）
downstream:
  - R8.C.spec-08: monitor popout（特定工具卡独立浮窗）
  - R8.C.spec-32: 观测仪表盘
```

---

## 12. fallback_strategy

```yaml
on_browserwindow_fail:
  - 退化到主窗内 Drawer（spec R8.B.spec-03）
on_snapshot_overflow:
  - 节流提升到 200ms + 仅推送 diff
on_preload_missing:
  - 强制重启 + 提示用户重装
flag_off_behavior:
  - R8.C.monitor.window=OFF 时菜单不显示"打开监控"
```

---

## 13. performance_budget

```yaml
window_open_ms: { warn: 800, fatal: 3000 }
snapshot_throttle_ms: 100
snapshot_payload_kb: { warn: 32, fatal: 256 }
renderer_fps: { warn_below: 30, fatal_below: 15 }
memory_mb: { warn: 80, fatal: 256 }
ipc_channel: monitor:snapshot-stream → spec-31 high_freq_scan 30 RPM (after throttle)
```

---

## 14. implementation_evidence_2026-05-04

```yaml
status: partial_verified_executable_monitor_bridge
implemented:
  - shared_zod_contracts:
  - MonitorWindowState
  - ToolMonitorCard
  - MonitorSnapshot
  - executable_ipc:
  - monitor:open
  - monitor:close
  - monitor:snapshot
  - monitor:set-window-prefs
  - monitor:focus-instance
  - monitor_open:
  mechanism: reuse_existing_R8B_browserwindow_popout_bridge
  title: DevHub Monitor
  surface: monitor
  targetId: overview
  - snapshot_truth_sources:
  - CLIOutputParser sessions and stored CliOutputEvent history
  - CursorCopilotDetector signals from existing scannerCache window metadata
  - no detectTools probes inside snapshot
  - window_prefs:
  confirmedBy_required: true
  persisted_fields: [alwaysOnTop, opacity, bounds]
  live_application: setAlwaysOnTop + setOpacity + setBounds on active BrowserWindow
verified:
  - targeted_vitest: 3 files / 39 tests passed
  - typecheck: passed
  - lint: passed
  - no_emoji: passed over 279 files
  - full_vitest: 56 files / 494 tests passed with --maxWorkers=1
  - license: passed
  - gitnexus: R8RuntimeService LOW risk; setupR8RuntimeHandlers LOW risk
closed_by_later_evidence:
  - dedicated renderer monitor entry under src/renderer/monitor: closed by 2026-05-14 out/renderer/monitor.html build evidence
  - dedicated preload subset for monitor renderer: closed by 2026-05-14 out/preload/monitor.cjs build evidence
  - monitor:snapshot-stream 100ms push loop: closed by 2026-05-14 packaged stream assertion after setWindowPrefs
  - visual ToolCard/ConfidenceBadge/TokenCounter renderer components: closed by MonitorWindowCards packaged renderer coverage
  - Playwright Electron GWT coverage: closed by 2026-05-14 spec-07 packaged Electron GWT
  - audit-log rows for monitor open/close: closed by executable monitor:open and monitor:close runtime paths
notes:
  - The implemented slice opens a real Electron BrowserWindow through the existing R8.B bridge in production.
  - Empty tools are rendered as inactive snapshot cards; no synthetic running progress is generated.
```

## 18. implementation_evidence_2026-05-14_packaged_playwright_gwt

```yaml
status: verified_dedicated_monitor_renderer_and_packaged_playwright_gwt
implemented:
  - dedicated_monitor_build_entries:
  files:
  - devhub/electron.vite.config.ts
  - devhub/src/renderer/monitor.html
  - devhub/src/renderer/monitor.tsx
  - devhub/src/preload/monitor.ts
  behavior:
  - electron-vite builds out/renderer/monitor.html for the main R8 monitor BrowserWindow
  - electron-vite builds out/preload/monitor.cjs as an independent monitor-only preload
  - R8RuntimeService loads the dedicated monitor renderer/preload only for surface=monitor targetId=r8-monitor
  - minimum_permission_preload_subset:
  file: devhub/src/preload/monitor.ts
  exposed_namespace: window.devhub.r8.monitor
  denied_namespaces:
  - window.devhub.projects
  - window.devhub.systemProcess
  - window.devhub.r8.popout
  - window.devhub.r8.cli
  - packaged_electron_gwt:
  file: devhub/e2e/example.spec.ts
  test: R8.C spec-07 monitor BrowserWindow covers packaged five-GWT lifecycle
  coverage:
  - opens a real monitor BrowserWindow through window.devhub.r8.monitor.open()
  - verifies r8Popout query routing and dedicated monitor renderer surface
  - verifies five real snapshot-backed ToolCards
  - verifies the packaged monitor exposes only window.devhub.r8.monitor and denies project/systemProcess/r8.popout/r8.cli APIs
  - verifies out/preload/monitor.cjs and out/renderer/monitor.html exist after production build
  - verifies monitor:snapshot-stream after setWindowPrefs
  - verifies native BrowserWindow always-on-top and opacity application
  - closes the main window and confirms the monitor BrowserWindow stays alive with executable monitor.snapshot()
  - packaged_preload_path:
  file: devhub/src/main/services/R8RuntimeService.ts
  behavior: BrowserWindow popouts now use the same packaged out/preload/index.cjs path shape as the main window
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
  - command: pnpm -C devhub exec eslint src/preload/monitor.ts src/preload/monitor-popout.ts src/renderer/monitor.tsx src/renderer/monitor-popout.tsx src/renderer/components/monitor/MonitorWindowCards.tsx src/main/services/R8RuntimeService.ts e2e/example.spec.ts
  result: passed
  - command: pnpm -C devhub exec tsc --noEmit --pretty false
  result: passed
  - command: pnpm -C devhub build
  result: passed and emitted out/preload/monitor.cjs plus out/renderer/monitor.html; existing Monaco dynamic/static import warning remains non-fatal
  - command: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-0[78]" --workers=1 --reporter=line
  result: 2 passed
  - command: pnpm -C devhub check:no-emoji
  result: No emoji found in 610 files
closed_boundaries:
  - dedicated src/renderer/monitor multi-entry build
```

## 15. implementation_evidence_2026-05-08

```yaml
status: partial_verified_stream_and_renderer_slice
implemented:
  - browserwindow_options:
  file: devhub/src/main/services/R8RuntimeService.ts
  details:
  - monitor BrowserWindow now uses transparent background, resizable window, shadow, and macOS vibrancy when available
  - existing R8.B popout bridge remains the owner; no renderer-entry migration was introduced
  - snapshot_stream:
  channel: monitor:snapshot-stream
  throttle_ms: 100
  source: monitorSnapshot over real CLI parser events plus Cursor/Copilot title signals
  targets:
  - main renderer fallback
  - live monitor BrowserWindow popouts
  - preload_contract:
  file: devhub/src/preload/index.ts
  exposed_subset:
  - window.devhub.r8.monitor.open
  - window.devhub.r8.monitor.close
  - window.devhub.r8.monitor.snapshot
  - window.devhub.r8.monitor.setWindowPrefs
  - window.devhub.r8.monitor.focusInstance
  - window.devhub.r8.monitor.onSnapshotStream
  whitelist_doc: prompts/0421/contracts/23-ipc-contracts-master.md
  - renderer_cards:
  files:
  - devhub/src/renderer/components/monitor/MonitorWindowCards.tsx
  - devhub/src/renderer/components/monitor/R8OpsPanel.tsx
  details:
  - renders exactly five snapshot-backed tool cards from MonitorSnapshot
  - clicking a card calls monitor:focus-instance with the real progress or latest event instance id
  - ConfidenceBadge thresholds: <0.5 error, 0.5-0.7 warning, 0.7-0.9 accent, >=0.9 success
  - always-on-top checkbox and opacity slider persist through monitor:set-window-prefs with confirmedBy
  - audit:
  actions:
  - monitor:open
  - monitor:set-window-prefs
  - monitor:close
  result: success rows written through AuditLogger
  - feature_flag:
  name: R8.C.monitor.window
  default: ON through shared feature flag registry
verified:
  - command: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/MonitorPanel.test.tsx --testNamePattern "monitor|Monitor|preload|snapshot|confidence" --maxWorkers=1
  result: 4 files / 19 tests passed / 50 skipped by filter
  - command: pnpm -C devhub typecheck
  result: passed
  - command: pnpm -C devhub lint
  result: passed, including check:no-emoji over 580 files
  - command: pnpm -C devhub check:zod-sot
  result: passed
  - gitnexus_impact:
  openMonitorWindow: LOW
  closeMonitorWindow: LOW
  setMonitorWindowPrefs: LOW
  focusMonitorInstance: LOW
  createBrowserPopout: LOW
  parseCliChunk: LOW
  AppContent: LOW
  MonitorPanel: LOW
  R8OpsPanel: LOW
closed_by_later_evidence:
  - dedicated src/renderer/monitor multi-entry build: closed by 2026-05-14 out/renderer/monitor.html build evidence
  - packaged Electron Playwright 5 GWT suite: closed by 2026-05-14 spec-07 packaged E2E
```

## 17. implementation_evidence_2026-05-13_theme_4d_sync

```yaml
status: partial_verified_theme_4d_sync
implemented:
  - main_process_bridge:
  file: devhub/src/main/services/R8RuntimeService.ts
  evidence: broadcasts real theme settings to live BrowserWindow popouts over popout bridge
  payload_axes:
  - palette
  - density
  - radiusFamily
  - motionLevel
  - renderer_application:
  file: devhub/src/renderer/hooks/useTheme.ts
  evidence: popout bridge theme-settings messages are Zod-validated before applying to document
  document_datasets:
  - data-theme
  - data-palette
  - data-density
  - data-radius-family
  - data-motion-level
  - tests:
  files:
  - devhub/src/main/services/R8RuntimeService.test.ts
  - devhub/src/renderer/hooks/useTheme.test.tsx
  assertions:
  - main process sends real theme-settings bridge payload to live BrowserWindow popouts
  - renderer applies cyberpunk / compact / round / expressive axes to document datasets
  - renderer emits APP_SETTINGS_CHANGE_EVENT after applying synced settings
verified:
  - command: pnpm -C devhub test --run src/renderer/hooks/useTheme.test.tsx src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "theme sync|BrowserWindow popout theme|broadcasts real theme settings"
  result: 2 files passed, 2 tests passed, 87 skipped by filter
closed_by_later_evidence:
  - dedicated src/renderer/monitor multi-entry build: closed by 2026-05-14 out/renderer/monitor.html build evidence
  - packaged Electron Playwright 5 GWT suite: closed by 2026-05-14 spec-07 packaged E2E
```

## 16. implementation_evidence_2026-05-13_main_window_close_lifecycle

```yaml
status: partial_verified_main_window_close_lifecycle
implemented:
  - lifecycle_policy:
  file: devhub/src/main/services/R8RuntimeService.ts
  method: closeUnpinnedPopoutsForMainWindowClose
  behavior:
  - keeps the main monitor BrowserWindow alive when the main DevHub window emits close
  - preserves the monitor popout record as bridgeState=connected
  - continues to close unrelated unpinned BrowserWindow popouts under the existing R8.B policy
  - regression_tests:
  file: devhub/src/main/services/R8RuntimeService.test.ts
  cases:
  - closes only unpinned BrowserWindow popouts when the main window closes
  - keeps the main monitor BrowserWindow alive when the main app window closes
verified:
  - command: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "main monitor BrowserWindow alive|closes only unpinned BrowserWindow popouts"
  result: 1 file passed, 2 tests passed, 86 skipped by filter
  - command: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/renderer/components/monitor/MonitorWindowCards.test.tsx src/renderer/components/monitor/R8OpsPanel.test.tsx --maxWorkers=1 -t "monitor|Monitor|popout|Popout|preload"
  result: 5 files passed, 28 tests passed, 92 skipped by filter
  - command: pnpm -C devhub exec tsc --noEmit --pretty false
  result: passed
  - command: pnpm -C devhub check:no-emoji
  result: No emoji found in 606 files
closed_by_later_evidence:
  - dedicated src/renderer/monitor multi-entry build: closed by 2026-05-14 dedicated monitor renderer entry
  - packaged Electron Playwright 5 GWT suite: closed by 2026-05-14 spec-07 packaged E2E
  - explicit 4D theme synchronization test beyond token-class usage: closed by 2026-05-13 theme_4d_sync evidence and preserved through 2026-05-14 dedicated monitor renderer regression
```
