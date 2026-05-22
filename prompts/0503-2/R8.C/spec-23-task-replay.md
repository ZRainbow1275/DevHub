# R8.C spec-23 — 任务回放（B 文本时间线 + asciinema 加分 + 5 类多轨）

> **batch**: R8.C  |  **priority_in_batch**: #23（复盘体验）  |  **flag**: `R8.C.recording.replay`
> **depends_on**: spec-22（录像存储 + getEvents）+ spec-31（IPC 限流）+ spec-33（Zod SoT）+ R8.B spec-12（grid-layout 多面板）
> **blocks**: 无（终端节点）
> **decision_anchor**: V1-Q-7.I.2 答 B（文本时间线）+ asciinema 加分 / V1-Q-7.I.1 录像 5 类全开
> **estimated_loc**: 1200
> **risk**: low

---

## 1. motivation

```yaml
user_quote_v1_q_7_i_2: "B — 文本时间线 + asciinema 加分"
user_quote_v1_q_7_i_1: "5 类录像全选"
goals:
  - 5 轨同步回放：stdout / stdin / screenshot / fs / git-diff 时间轴对齐
  - 时间游标：用户拖动游标 → 5 轨跳转到对应 ts
  - 速度：0.25x / 0.5x / 1x / 2x / 4x / 8x
  - asciinema 内嵌：xterm.js 渲染 stdout cast 流（V1-Q-7.I.2 加分项）
  - 截图轨：缩略图 strip + 点击切到对应时间点
  - fs 轨：file-tree diff 视图（同时高亮 add/change/unlink）
  - git-diff 轨：split view（before / after）
  - 注入标记：stdin 中的 inject 事件以特殊图标标识 + 显示 InjectAction 详情
  - 跳转锚点：CliEvent type='error'/任务状态翻转都打锚点
  - 双向同步：拖动 stdout 时游标 → 截图轨 + fs 轨同步
  - 隐私：默认本地播放，不发起任何外部请求
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/renderer/components/recording-replay/RecordingReplayPanel.tsx
  - devhub/src/renderer/components/recording-replay/Timeline.tsx
  - devhub/src/renderer/components/recording-replay/TimelineCursor.tsx
  - devhub/src/renderer/components/recording-replay/StdoutTrack.tsx
  - devhub/src/renderer/components/recording-replay/StdinTrack.tsx
  - devhub/src/renderer/components/recording-replay/ScreenshotTrack.tsx
  - devhub/src/renderer/components/recording-replay/FsTrack.tsx
  - devhub/src/renderer/components/recording-replay/GitDiffTrack.tsx
  - devhub/src/renderer/components/recording-replay/AsciinemaPlayer.tsx  # xterm.js 内嵌
  - devhub/src/renderer/components/recording-replay/SpeedControl.tsx
  - devhub/src/renderer/components/recording-replay/AnchorList.tsx
  - devhub/src/renderer/components/recording-replay/ReplayClock.ts  # 主时钟 RAF
  - devhub/src/renderer/components/recording-replay/RecordingReplay.test.tsx
  - devhub/src/main/services/recording/AsciinemaConverter.ts  # cast 流转 xterm 序列
  - devhub/src/shared/schemas/replay-state.ts
modified_files:
  - devhub/src/main/ipc/recordingHandlers.ts  # recording:get-cast
  - devhub/src/renderer/router/routes.tsx  # /recordings/:id/replay
glob_anchors:
  - devhub/src/main/services/recording/RecordingRepository.ts  # spec-22
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { RecordingEventSchema, RecordingManifestSchema } from '@/shared/schemas/recording'

export const ReplaySpeedSchema = z.enum(['0.25', '0.5', '1', '2', '4', '8']).transform(Number)

export const ReplayStateSchema = z.object({
  recordingId: z.string().uuid(),
  manifest: RecordingManifestSchema,
  cursorTs: z.number().int(),  // current playback timestamp
  startedAtAbsTs: z.number().int(),
  endedAtAbsTs: z.number().int(),
  speed: z.number().refine(v => [0.25,0.5,1,2,4,8].includes(v)),
  paused: z.boolean(),
  enabledTracks: z.array(z.enum(['stdout','stdin','screenshot','fs','git-diff'])),
  anchors: z.array(z.object({
  ts: z.number().int(),
  kind: z.enum(['error', 'state-flip', 'inject', 'rotate', 'fs-burst']),
  label: z.string(),
  color: z.string().optional(),
  })),
})
export type ReplayState = z.infer<typeof ReplayStateSchema>

export const AsciinemaCastSchema = z.object({
  version: z.literal(2),
  width: z.number().int(),
  height: z.number().int(),
  timestamp: z.number().int(),
  title: z.string().optional(),
  events: z.array(z.tuple([z.number(), z.literal('o'), z.string()])),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  recording:get-replay-state:
  rate_limit: medium_query
  req: { recordingId: string }
  resp: ReplayState
  recording:get-events-window:
  rate_limit: medium_query
  req: { recordingId: string, sinceTs: number, untilTs: number, kinds?: string[] }
  resp: RecordingEvent[]
  recording:get-cast:
  rate_limit: medium_query
  req: { recordingId: string }
  resp: { cast: AsciinemaCast }
  recording:list-anchors:
  rate_limit: medium_query
  req: { recordingId: string }
  resp: { anchors: ReplayState['anchors'] }
  recording:get-screenshot:
  rate_limit: medium_query
  req: { recordingId: string, ts: number }
  resp: { filePath: string, width: number, height: number }
  recording:get-fs-snapshot-at:
  rate_limit: medium_query
  req: { recordingId: string, ts: number }
  resp: { tree: Array<{ path: string, op: string, sizeBytes?: number }> }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| recordingId 不存在 | E_NOT_FOUND |
| manifest 损坏 | E_INTEGRITY_FAIL |
| cast 转换失败 | E_RUNTIME |
| 截图文件丢失 | E_NOT_FOUND（占位图） |
| ts 超出范围 | E_VALIDATION |
| 速度参数非法 | E_VALIDATION |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础回放):
  given: 已有 60s 录像
  when: 用户点击"播放" speed=1x
  then:
  - cursorTs 每秒推进 1000
  - stdout 轨实时打字效果
  - 截图轨同步切图

GWT-2 (拖动游标多轨同步):
  given: 录像 5 轨
  when: 用户拖游标到 30s
  then: stdout/stdin/screenshot/fs/git-diff 五轨都跳到 30s 状态

GWT-3 (倍速):
  given: speed=4
  when: 播放
  then: cursorTs 每秒推进 4000；CPU < 30%

GWT-4 (asciinema 加分):
  given: 用户切到 'asciinema' 视图
  when: AsciinemaPlayer 加载
  then:
  - xterm.js 渲染 cast 流
  - 与主时钟同步（cursorTs 控制 cast playback time）
  - 字符级真实重放

GWT-5 (锚点跳转):
  given: 录像内含 1 条 'error' 锚点 ts=45000
  when: 用户点 AnchorList 中该锚点
  then: cursorTs 跳到 45000；其他轨同步

GWT-6 (注入标识):
  given: stdin 含 1 条 origin='inject' actionId=A1
  when: 渲染 StdinTrack
  then:
  - 该条目显示注入图标
  - hover 显示 InjectAction 详情（target/mode/scenario）

GWT-7 (file-tree diff at ts):
  given: ts=20000，fs 历史含 add A.txt, change B.txt
  when: getFsSnapshotAt(20000)
  then: tree 含两条目，op 标识；UI 高亮

GWT-8 (轨道开关):
  given: enabledTracks 关掉 'screenshot'
  when: 拖动游标
  then: 截图轨不渲染；其他轨正常
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-23-replay.spec.ts
test('GWT-2 cursor drag syncs all 5 tracks', async ({ page }) => {
  await page.goto('app://./recordings/REC-1/replay')
  const slider = page.locator('[data-testid="timeline-cursor"]')
  await slider.evaluate((el) => {
  (el as HTMLInputElement).value = '30000'
  el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const stdoutCursor = await page.locator('[data-testid="stdout-cursor-ts"]').textContent()
  const fsCursor = await page.locator('[data-testid="fs-cursor-ts"]').textContent()
  expect(stdoutCursor).toBe('30000')
  expect(fsCursor).toBe('30000')
})

test('GWT-4 asciinema player', async ({ page }) => {
  await page.goto('app://./recordings/REC-1/replay')
  await page.click('[data-testid="view-asciinema"]')
  await expect(page.locator('.xterm')).toBeVisible()
  await page.click('[data-testid="play-btn"]')
  await page.waitForFunction(() => (document.querySelector('.xterm-screen')?.textContent || '').length > 100)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'xterm@5.x':  asciinema 终端模拟
  - 'xterm-addon-fit@0.10':  自适应大小
  - 'react-zoomable@x':  截图缩放
  - 'react-virtuoso@4.x':  stdout 轨长列表
  - 'monaco-diff-editor':  git-diff split view
  - 'lodash.debounce':  游标拖动防抖
inspirations:
  - "asciinema-player（cast v2）"
  - "Cypress Test Replay"
  - "Datadog Session Replay"
  - "VS Code Live Share replay"
ui_layout: |
  +------------------------------------------+
  | Timeline 整条 + cursor + anchors  |
  +-----------------+------------------------+
  | stdout / cast  | screenshot 缩略图 strip|
  +-----------------+------------------------+
  | stdin events  | fs tree diff at cursor |
  +-----------------+------------------------+
  | git-diff split (before / after)  |
  +------------------------------------------+
  speed: 0.25x .. 8x  ; play/pause; anchors list
clock_strategy: |
  RAF main clock at 60Hz
  cursorTs += deltaMs * speed each frame
  cap to manifest.endedAt
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~800
modified_loc: ~50
test_loc: ~350
total: ~1200
risk_areas:
  - 5 轨同步漂移（用主时钟，所有轨 derived）
  - 截图 strip 数百张时的内存（虚拟化 + 缓存策略）
  - asciinema cast 大量字符的渲染（xterm 已优化但需测试）
  - 8x 倍速下 stdout 滚动平滑度
```

---

## 10. implement_checklist

- [x] ReplayClock 主时钟 RAF；所有轨从 cursorTs 派生
- [x] StdoutTrack 用项目已安装的 `@tanstack/react-virtual` 虚拟列表 + 自动滚动到 cursor
- [x] StdinTrack 标识 inject 图标，hover 显示真实记录到 stdin 事件的 InjectAction 元数据
- [x] ScreenshotTrack 缩略图 strip（虚拟化）+ 点击跳转
- [x] FsTrack 显示截至 cursor 的累积 file tree（计算 fold/diff）
- [x] GitDiffTrack 用 `@monaco-editor/react` DiffEditor 显示 pre/post diff，并在无 canvas 环境使用真实文本降级
- [x] AsciinemaPlayer xterm.js 实例 + cast 数据驱动写 + 速度同步
- [x] AnchorList 自动从 stdout(error/state-flip) + stdin(inject) + fs(burst) + manifest(rotate) 派生锚点
- [x] SpeedControl 6 档；speed 改变重置 RAF delta 累积
- [x] feature flag `R8.C.recording.replay` 默认 ON
- [x] 性能：虚拟化长轨 + RAF speed 单测 + 全量 Vitest；packaged Electron 8x CPU 采样列入运行态性能门禁
- [x] vitest coverage: real recording service replay / anchor jump / asciinema cast / renderer five-track sync / track toggle / ReplayClock speed
- [x] 关闭/最小化窗口暂停时钟避免 CPU 浪费

---

## 11. dependencies

```yaml
upstream:
  - spec-22: 录像存储 + getEvents
  - spec-31: IPC 限流
  - spec-33: Zod SoT
  - R8.B spec-12: grid layout
downstream:
  - spec-29: 反馈循环点击"问题"按钮 → 跳到该录像时间点
  - spec-32: 观测面板入口"查看录像"
```

---

## 12. fallback_strategy

```yaml
on_screenshot_missing:
  - 显示占位图 + "原始文件丢失"
on_cast_convert_fail:
  - 退化到纯文本 stdout 轨（无终端模拟）
on_perf_degradation:
  - 自动降级 speed 到 1x
  - 关闭部分轨（screenshot 优先关）
flag_off_behavior:
  - R8.C.recording.replay=OFF → 仅显示 manifest 列表，无回放 UI
```

---

## 13. performance_budget

```yaml
load_recording_p95_ms: 500
cursor_seek_p95_ms: 200
ascii_render_p95_ms_per_1000_events: 100
screenshot_strip_render_p95_ms_per_50_thumbs: 300
fs_tree_compute_p95_ms_per_500_events: 80
speed_8x_cpu_pct_warn: 30
speed_8x_cpu_pct_fatal: 60
memory_per_replay_session_mb: 200
ipc_channel: recording:get-events-window → spec-31 medium_query 60 RPM
clock_tick_hz: 60
```

---

## implementation_status_2026-05-04

```yaml
status: implemented_and_verified
implementation_scope:
  shared_contracts:
  - devhub/src/shared/schemas/replay-state.ts
  - devhub/src/shared/schemas/recording.ts injectAction metadata extension
  - devhub/src/shared/schemas/r8-runtime.ts spec-23 channel registry
  main_runtime:
  - devhub/src/main/services/recording/RecordingService.ts replay readers over real spec-22 artifacts
  - devhub/src/main/services/recording/AsciinemaConverter.ts asciinema v2 cast conversion
  - devhub/src/main/services/R8RuntimeService.ts replay bridge methods
  - devhub/src/main/ipc/r8RuntimeHandlers.ts rate-limited executable handlers
  preload_renderer:
  - devhub/src/preload/index.ts narrow replay bridge
  - devhub/src/renderer/types/global.d.ts replay bridge typing
  - devhub/src/renderer/components/recording-replay/* five-track replay UI
  - devhub/src/renderer/components/monitor/R8OpsPanel.tsx replay entry card
  contract_docs:
  - prompts/0421/contracts/23-ipc-contracts-master.md preload whitelist
no_mock_guarantees:
  - Replay state, windows, screenshots, fs tree, anchors, and cast all read real manifest/NDJSON/PNG artifacts emitted by spec-22.
  - Screenshot lookup validates real PNG signature and dimensions; missing files return E_NOT_FOUND instead of fake images.
  - Stdin inject details are persisted only when supplied by the real executeInject path; UI does not fabricate target/mode/scenario.
  - Monaco falls back to real text in no-canvas test environments; browser-capable environments use the actual DiffEditor component.
verification:
  - pnpm typecheck: passed
  - pnpm lint: passed, no emoji found in 353 files
  - targeted_spec_23_suite: 7 files passed, 65 tests passed, --maxWorkers=1
  - pnpm check:license: passed, 400 production package entries validated, 1 documented exception retained
  - full_vitest: 71 files passed, 569 tests passed, --maxWorkers=1
known_runtime_gate:
  - packaged Electron 8x CPU sampling is an operational performance gate; local CI covers RAF speed semantics and virtualized long-track rendering deterministically.
```

post_index_verification_2026-05-04:
  gitnexus_analyze: "indexed 4215 nodes, 13022 edges, 332 clusters, 300 flows"
  gitnexus_impact:
  RecordingService: LOW
  R8RuntimeService: LOW
  setupR8RuntimeHandlers: LOW
  gitnexus_status: "up to date for commit de634f9"
