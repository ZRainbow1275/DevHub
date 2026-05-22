# R8.C spec-22 — 任务录像（stdout / stdin / 截图 / fs / diff 5 类）

> **batch**: R8.C  |  **priority_in_batch**: #22（可观察性 + 复盘）  |  **flag**: `R8.C.recording.engine`
> **depends_on**: spec-15（task queue 触发录像 start/stop）+ spec-18（注入事件绑定）+ spec-31（IPC 限流）+ spec-33（Zod SoT）+ R8.A spec-10（audit log）
> **blocks**: spec-23（回放消费录像数据）
> **decision_anchor**: V1-Q-7.I.1 全选 5 类 / V1-Q-1.E.4 答 B + 可选 C / V1-Q-16.E.1 全选 artifact / feedback#4 监控复盘需要
> **estimated_loc**: 1400
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_7_i_1: "全选：stdout / stdin / 截图 / fs 改动 / git diff"
user_quote_v1_q_1_e_4: "B（每条任务带录像）+ C（asciinema 加分）"
user_quote_v1_q_16_e_1: "全选 artifact：stdout / 退出码 / 时长 / CPU/RSS / git diff / output_files / 截图 / 信号融合得分历史 / 状态翻转日志"
feedback_4: "整体永远可回放：5 类录像；解决迟报漏报"
privacy_zero_telemetry: "录像只存本地，不上传"

goals:
  - 5 类录像通道：stdout / stdin / screenshot / fs / git-diff
  - stdout/stdin：append-only NDJSON（CliEvent 派生 + 注入 InjectAction）
  - screenshot：ROI 限制（仅目标窗口 + cwd 文件树），频率默认 N=10s 可调，可关
  - fs：chokidar 监听 cwd，记录 add/change/unlink + sha256 diff
  - git-diff：每个任务前后 git diff --stat + 完整 diff
  - 容器格式：每任务一目录 `%APPDATA%/devhub/recordings/{sessionId}/{taskId}/` 含 manifest.json + streams + screenshots/ + fs-events.ndjson + git-diff.txt
  - 滚动：单任务 ≤ 1GB，超限旋转 + 通知；总磁盘 ≤ 50GB LRU 淘汰
  - asciinema 兼容：stdout 流可导出为 .cast 格式
  - 录像绑定 actionId / taskId / sessionId 三层关联
  - 隐私：用户可一键脱敏导出（脱敏 API key / token / 密码）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/recording/RecordingService.ts
  - devhub/src/main/services/recording/RecordingSession.ts
  - devhub/src/main/services/recording/streams/StdoutStream.ts
  - devhub/src/main/services/recording/streams/StdinStream.ts  # 注入文本 + 用户输入
  - devhub/src/main/services/recording/streams/ScreenshotStream.ts
  - devhub/src/main/services/recording/streams/FsStream.ts  # chokidar
  - devhub/src/main/services/recording/streams/GitDiffStream.ts
  - devhub/src/main/services/recording/RecordingRepository.ts  # SQLite 索引
  - devhub/src/main/services/recording/RecordingRotator.ts  # 大小/总额淘汰
  - devhub/src/main/services/recording/RecordingExporter.ts  # asciinema cast / zip
  - devhub/src/main/services/recording/Redactor.ts  # API key 脱敏
  - devhub/src/main/services/recording/RecordingService.test.ts
  - devhub/src/shared/schemas/recording.ts
modified_files:
  - devhub/src/main/services/task-queue/TaskQueueService.ts  # task-start → recording:start
  - devhub/src/main/services/inject/InjectService.ts  # actionId → recording stdin
  - devhub/src/main/ipc/recordingHandlers.ts
  - devhub/src/main/index.ts
glob_anchors:
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts  # spec-01 stdout 来源
  - devhub/src/main/services/audit/AuditLogger.ts  # R8.A spec-10
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const RecordingStreamKindSchema = z.enum(['stdout', 'stdin', 'screenshot', 'fs', 'git-diff'])

export const RecordingManifestSchema = z.object({
  recordingId: z.string().uuid(),
  sessionId: z.string().uuid(),
  taskId: z.string(),
  alias: z.string().optional(),
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']).optional(),
  startedAt: z.number().int(),
  endedAt: z.number().int().nullable(),
  cwd: z.string(),
  enabledStreams: z.array(RecordingStreamKindSchema),
  screenshotIntervalMs: z.number().int().default(10000),
  totalBytesOnDisk: z.number().int(),
  rotated: z.boolean().default(false),
  redactionApplied: z.boolean().default(false),
})
export type RecordingManifest = z.infer<typeof RecordingManifestSchema>

export const StdoutEventSchema = z.object({
  ts: z.number().int(),
  kind: z.literal('stdout'),
  rawSource: z.enum(['ndjson', 'shim', 'line', 'sse']),
  type: z.string(),  // CliEvent.type
  payload: z.record(z.string(), z.unknown()),
})

export const StdinEventSchema = z.object({
  ts: z.number().int(),
  kind: z.literal('stdin'),
  origin: z.enum(['user', 'inject']),
  injectActionId: z.string().uuid().nullable(),
  text: z.string(),  // 完整文本（受 redaction 影响）
})

export const ScreenshotEventSchema = z.object({
  ts: z.number().int(),
  kind: z.literal('screenshot'),
  filePath: z.string(),  // recordings/.../screenshots/2026-05-03T...png
  hwnd: z.number().int().nullable(),
  region: z.enum(['window', 'cwd-tree', 'fullscreen']),
  sizeBytes: z.number().int(),
})

export const FsEventSchema = z.object({
  ts: z.number().int(),
  kind: z.literal('fs'),
  op: z.enum(['add', 'change', 'unlink', 'addDir', 'unlinkDir']),
  path: z.string(),
  sha256Before: z.string().nullable(),
  sha256After: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
})

export const GitDiffEventSchema = z.object({
  ts: z.number().int(),
  kind: z.literal('git-diff'),
  phase: z.enum(['pre-task', 'post-task']),
  branch: z.string(),
  headSha: z.string().regex(/^[a-f0-9]{40}$/),
  diffStat: z.string(),
  diffPath: z.string(),  // 完整 diff 写到独立文件
})

export const RecordingEventSchema = z.discriminatedUnion('kind', [
  StdoutEventSchema, StdinEventSchema, ScreenshotEventSchema, FsEventSchema, GitDiffEventSchema,
])
export type RecordingEvent = z.infer<typeof RecordingEventSchema>

export interface IRecordingService {
  start(opts: {
  sessionId: string,
  taskId: string,
  cwd: string,
  enabledStreams?: RecordingStreamKind[],
  screenshotIntervalMs?: number,
  }): Promise<RecordingManifest>
  stop(recordingId: string): Promise<RecordingManifest>
  list(filter?: { sessionId?: string, taskId?: string, sinceTs?: number }): Promise<RecordingManifest[]>
  exportAsciinema(recordingId: string, outPath: string): Promise<{ filePath: string }>
  exportZip(recordingId: string, outPath: string, opts: { redact: boolean }): Promise<{ filePath: string }>
  delete(recordingId: string): Promise<{ deleted: boolean }>
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  recording:start:
  rate_limit: low_freq_op
  req: { sessionId, taskId, cwd, enabledStreams?, screenshotIntervalMs? }
  resp: RecordingManifest
  recording:stop:
  rate_limit: low_freq_op
  req: { recordingId: string }
  resp: RecordingManifest
  recording:list:
  rate_limit: medium_query
  req: { sessionId?, taskId?, sinceTs? }
  resp: RecordingManifest[]
  recording:get-events:
  rate_limit: medium_query
  req: { recordingId: string, kind?: RecordingStreamKind, sinceTs?: number, limit?: number }
  resp: RecordingEvent[]
  recording:export-asciinema:
  rate_limit: low_freq_op
  req: { recordingId: string, outPath: string }
  resp: { filePath: string }
  recording:export-zip:
  rate_limit: low_freq_op
  req: { recordingId: string, outPath: string, redact: boolean }
  resp: { filePath: string }
  recording:delete:
  rate_limit: low_freq_op
  req: { recordingId: string }
  resp: { deleted: boolean }
  recording:event-stream:
  direction: main->renderer
  streaming: true
  payload: RecordingEvent & { recordingId: string }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| sessionId/taskId 未知 | E_NOT_FOUND |
| 磁盘空间不足 | E_RUNTIME |
| 单任务 > 1GB | E_QUOTA_EXCEEDED（自动 rotate） |
| chokidar 失败 | E_RUNTIME |
| screenshot 权限拒绝 | E_PERMISSION_DENIED |
| asciinema export 失败 | E_RUNTIME |
| zip 文件已存在 | E_VALIDATION |
| git not in cwd | E_NOT_FOUND（git-diff 流自动 disable） |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (5 类全开):
  given: spec-15 task-start emit, enabledStreams 全选
  when: RecordingService.start
  then:
  - manifest.enabledStreams === 5 项
  - recordings/.../{taskId}/manifest.json 创建
  - 5 类 stream 同时启动

GWT-2 (stdout 来自 spec-01):
  given: 任务 tool=claude, NdjsonStrategy emit CliEvent
  when: RecordingSession 订阅 cli:event-stream
  then:
  - StdoutStream 写入 stdout.ndjson
  - 5min 后 wc -l ≥ 10

GWT-3 (stdin 包含 inject):
  given: spec-18 inject:execute success
  when: RecordingSession 订阅 inject 事件
  then:
  - StdinEvent 含 injectActionId + 完整 text
  - origin === 'inject'

GWT-4 (screenshot 频率):
  given: screenshotIntervalMs=10000，任务跑 60s
  when: RecordingSession.stop
  then: screenshots/ 目录下 PNG 数 6 ± 1

GWT-5 (fs 监听 add/change/unlink):
  given: 任务在 cwd 创建/修改/删除文件
  when: RecordingSession 订阅 chokidar
  then:
  - FsEvent.op 三种类型都出现
  - sha256Before/After 仅在 change 时双写

GWT-6 (git-diff 前后):
  given: cwd 是 git repo
  when: start + stop
  then:
  - GitDiffEvent phase='pre-task' 与 'post-task' 各一条
  - diffStat 字符串非空
  - 完整 diff 写到 git-diff.txt

GWT-7 (rotate 1GB):
  given: stdout 持续输出导致总占用 ≥ 1GB
  when: RecordingRotator 触发
  then:
  - manifest.rotated=true
  - 通知用户（spec-30 WARN）
  - 旧分片移到 .archive/

GWT-8 (asciinema 导出兼容):
  given: 一个完成的录像
  when: exportAsciinema
  then:
  - 输出 .cast 文件
  - asciinema play 能播放（CI 验证用 cast 解析器）

GWT-9 (脱敏导出):
  given: stdin 含 'OPENAI_API_KEY=sk-xxx'
  when: exportZip with redact=true
  then:
  - zip 内 stdin.ndjson 该字符串替换为 'OPENAI_API_KEY=***'
  - manifest.redactionApplied=true
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-22-recording.spec.ts
test('GWT-2 stdout recorded from spec-01', async ({ page }) => {
  const m = await page.evaluate(() => window.electronAPI.recording.start({
  sessionId: 's1', taskId: 't1', cwd: process.cwd(),
  enabledStreams: ['stdout'],
  }))
  // emit fake CliEvents
  await page.evaluate(() => window.electronAPI.test.emitCliEvents(['progress','tool-use','message-out']))
  await new Promise(r => setTimeout(r, 1500))
  const events = await page.evaluate((id) => window.electronAPI.recording.getEvents({ recordingId: id, kind: 'stdout' }), m.recordingId)
  expect(events.length).toBeGreaterThanOrEqual(3)
})

test('GWT-9 redacted export', async ({ page, browserName }, testInfo) => {
  const out = `${testInfo.outputDir}/redacted.zip`
  const r = await page.evaluate(async (out) => {
  const m = await window.electronAPI.recording.start({ sessionId: 's2', taskId: 't2', cwd: process.cwd(), enabledStreams:['stdin'] })
  await window.electronAPI.test.emitStdin('OPENAI_API_KEY=sk-test-xyz')
  await window.electronAPI.recording.stop({ recordingId: m.recordingId })
  return await window.electronAPI.recording.exportZip({ recordingId: m.recordingId, outPath: out, redact: true })
  }, out)
  expect(r.filePath).toBe(out)
  // 校验 zip 内文本
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'chokidar@4.x':  fs 监听
  - 'screenshot-desktop@1.x':  screenshot
  - 'simple-git@3.x':  git diff / status
  - 'archiver@7.x':  zip 导出
  - 'better-sqlite3@11.x':  recording 索引
  - 'asciinema-recorder@x' / custom:  .cast v2 格式输出
  - 'crypto':  sha256 哈希
  - 'p-queue@8.x':  screenshot rate-limited 队列
inspirations:
  - "asciinema rec / play"
  - "Replit replay"
  - "Cypress test recordings"
  - "Loom 桌面录屏"
recording_dir_layout: |
  recordings/
  {sessionId}/
  {taskId}/
  manifest.json
  stdout.ndjson
  stdin.ndjson
  fs-events.ndjson
  git-diff.txt
  screenshots/
  2026-05-03T15-00-00-000.png
  .archive/  # rotated parts
asciinema_cast_v2_header: |
  {"version": 2, "width": 120, "height": 40, "timestamp": <unix>, "title": "<taskId>"}
  [delay_seconds, "o", "<data>"]
redact_patterns:
  - /OPENAI_API_KEY=[a-zA-Z0-9-]+/
  - /ANTHROPIC_API_KEY=[a-zA-Z0-9-]+/
  - /password\s*[:=]\s*\S+/i
  - /token\s*[:=]\s*\S+/i
  - /[A-Za-z0-9]{40,}/  # 通用长 token
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~80
test_loc: ~420
total: ~1400
risk_areas:
  - chokidar 在大型 monorepo cwd 上的 CPU 影响（默认排除 node_modules / .git）
  - screenshot 性能（需异步队列避免阻塞主进程）
  - 总磁盘 LRU 淘汰策略 vs 用户重要任务的保留
  - 脱敏正则的误命中（如 git sha 也是 40 hex）
```

---

## 10. implement_checklist

- [x] RecordingSession 启动 5 stream（每个独立 disposable）
- [x] StdoutStream 订阅 cli:event-stream + 过滤 sessionId/taskId
- [x] StdinStream 订阅 inject:stream + 用户键盘事件（如有）
- [x] ScreenshotStream 用 p-queue 限速（默认 1/10s），写 PNG 到 screenshots/
- [x] FsStream chokidar({ ignored: ['**/node_modules/**', '**/.git/**', '**/.devhub-recordings/**'] })
- [x] GitDiffStream pre-task/post-task 各调一次 simple-git diff --stat + diff
- [x] RecordingRotator 监控 totalBytesOnDisk，超限 rename → .archive/{ts}/
- [x] LRU 全局淘汰：≤ 50GB 总额，最久未访问优先
- [x] Redactor 在 export 时应用，原文件不动（保留可恢复）
- [x] feature flag `R8.C.recording.engine` 默认 ON；子项 `screenshot`/`fs`/`git-diff` 各自可关
- [x] audit log: start / stop / rotate / lru-evict / redacted-export
- [x] vitest fixture: 5-stream-baseline / rotate-1gb / redact-key / asciinema-export
- [x] 性能：stdout 写入 1000 行 < 80ms
- [x] 性能：screenshot 不阻塞 task

---

## 11. dependencies

```yaml
upstream:
  - spec-15: TaskQueueService task-start/end → recording start/stop
  - spec-18: InjectService → stdin events
  - spec-31: IPC 限流
  - spec-33: Zod SoT
  - spec-01: CliEvent 流来源
  - R8.A spec-10: audit log
downstream:
  - spec-23: 回放消费 RecordingEvent
  - spec-26: flow 图可叠加 fs 事件
  - spec-29: 反馈循环对比录像 → 标注误报
  - spec-32: 观测面板列录像列表
  - spec-36: 诊断包含录像（脱敏）
```

---

## 12. fallback_strategy

```yaml
on_disk_full:
  - 立即停止 screenshot 流
  - 通知用户 ERROR
  - 触发 LRU 淘汰
on_screenshot_permission_denied:
  - 移除该 stream
  - 其他 4 类继续
on_git_not_in_cwd:
  - 自动跳过 git-diff stream
on_chokidar_overflow:
  - 增大 awaitWriteFinish + 限速
  - 通知 INFO
flag_off_behavior:
  - R8.C.recording.engine=OFF → 仅写最简单的 stdout NDJSON 到 audit log
```

---

## 13. performance_budget

```yaml
recording_start_p95_ms: 200
stdout_write_p95_ms_per_event: 1
fs_event_emit_p99_ms: 30
screenshot_capture_p95_ms: 300
git_diff_p95_seconds: 3
single_task_size_max_bytes: 1073741824  # 1 GB
total_disk_max_bytes: 53687091200  # 50 GB
lru_eviction_check_interval_seconds: 300
screenshot_default_interval_ms: 10000
screenshot_min_interval_ms: 2000
chokidar_excludes: ['node_modules','.git','.devhub-recordings']
ipc_channel: recording:event-stream → spec-31 high_freq_scan 30 RPM（聚合）
ipc_channel: recording:start/stop → spec-31 low_freq_op 120 RPM
```


---

## 14. implementation_status_2026-05-04

Status: executable vertical slice completed in `devhub` for the spec-22 recording engine foundation.

Completed implementation targets:

- Zod SoT added in `src/shared/schemas/recording.ts` and registered through `src/shared/schemas/r8-runtime.ts`.
- Real recording directory layout implemented under `userData/recordings/{sessionId}/{taskId}/` with `manifest.json`, `stdout.ndjson`, `stdin.ndjson`, `screenshots.ndjson`, `fs-events.ndjson`, `git-diff.ndjson`, `git-diff.txt`, `screenshots/`, and `.archive/`.
- Real stdout capture is connected to `R8RuntimeService.parseCliChunk` and writes append-only NDJSON events.
- Real stdin capture is connected to successful `R8RuntimeService.executeInject` calls when a recording association is present.
- Real filesystem capture uses `chokidar` with `node_modules`, `.git`, `.devhub-recordings`, and `recordings` exclusions, and records SHA-256 before/after hashes where available.
- Real git-diff capture executes local `git` for pre-task and post-task stat/full diff artifacts, and records `E_NOT_FOUND` in the manifest when `cwd` is not a git repository.
- Screenshot capture uses Electron `BrowserWindow.capturePage()` and records `E_PERMISSION_DENIED` when no capturable window is available; it does not fabricate PNG artifacts.
- Per-task rotation, global quota LRU eviction, asciinema v2 `.cast` export, and redacted ZIP export are implemented without mock data.
- IPC/preload/renderer contracts now cover `recording:start`, `recording:stop`, `recording:list`, `recording:get-manifest`, `recording:get-events`, `recording:export-asciinema`, `recording:export-zip`, `recording:delete`, and `recording:event-stream`.

Verified acceptance coverage:

- GWT-1 foundation: manifest and stream files are created for all five stream kinds.
- GWT-2 foundation: stdout events emitted by the real CLI parser bridge are persisted to `stdout.ndjson`.
- GWT-3 foundation: successful inject calls can persist stdin events with `injectActionId` and full text.
- GWT-5: real filesystem add/change/unlink events are captured with SHA-256 transitions.
- GWT-6: real pre/post git diff events and `git-diff.txt` are written in a real git repository.
- GWT-7: per-task stream rotation marks `manifest.rotated=true` and archives prior stream parts.
- GWT-8: asciinema v2 export writes a parseable NDJSON `.cast` file with v2 header and output events.
- GWT-9: redacted ZIP export replaces sensitive keys such as `OPENAI_API_KEY=...` while leaving source artifacts intact.

Verification completed:

- `pnpm test --run src/main/services/recording/RecordingService.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1`: 5 files passed, 62 tests passed.
- `pnpm exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1`: verified real audit entries for recording start, stop, rotate, lru-evict, and redacted export.
- `pnpm exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1 -t "1000 stdout writes"`: verified the real append-only stdout hot path stays under the 80ms / 1000-line budget.
- `pnpm exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1 -t "keeps stdout task work non-blocking"`: verified repeated screenshot timer ticks do not overlap `capturePage()`, queued captures are cleared on stop, and 1000 stdout task events stay under the 80ms budget while capture is unresolved.
- `pnpm exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1 -t "1GB sparse fixture"`: verified the real 1GB sparse fixture stays on disk and is counted in the stopped manifest.
- `pnpm exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1`: 8 tests passed after the append-only queue, p-queue screenshot, and 1GB sparse-fixture additions.
- `pnpm exec vitest run src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts --maxWorkers=1 -t "recording"`: 4 recording-focused runtime/IPC tests passed after the queue changes.
- `pnpm add simple-git@^3.28.0`: installed `simple-git@3.36.0`; `pnpm typecheck`, touched-file ESLint, `RecordingService.test.ts`, and recording runtime/IPC tests passed after replacing raw `execFile('git')` calls.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed, including no-emoji scan over 337 files.
- `pnpm test --run --maxWorkers=1`: 69 files passed, 566 tests passed.
- `pnpm check:license`: passed.
- GitNexus post-edit impact for `RecordingService`, `R8RuntimeService`, and `setupR8RuntimeHandlers`: LOW.

Deferred but not faked:

- A packaged Electron 60-second screenshot-frequency benchmark is not claimed in this slice.
- Keyboard/user input outside the existing inject path is not claimed in this slice.
- Full task-queue automatic start/stop wiring for every scheduler path is reserved for the next scheduler integration pass.
- A dedicated renderer recording browser UI is reserved for downstream recording/replay surfaces.

---

## 15. implementation_status_2026_05_11_recording_flags_retention_sync

```yaml
status: recording_engine_partial_verified
implemented:
  - R8RuntimeService now enforces R8.C.recording.engine before starting both real and legacy recording sessions.
  - Added default-ON optional stream flags R8.C.recording.engine.screenshot, R8.C.recording.engine.fs, and R8.C.recording.engine.git-diff; disabled optional stream flags are filtered before RecordingService.start.
  - RecordingService tests now verify that redacted ZIP export leaves source stdin.ndjson recoverable and that stopped recordings are evicted by least-recently-accessed order when the global quota is exceeded.
  - Existing RecordingService coverage verifies real stdout/stdin/git-diff artifacts, chokidar fs add/change/unlink events, stream rotation into .archive, asciinema cast export, redacted ZIP export, replay windows, screenshot lookup from artifacts, and fs snapshots.
  - RecordingService now emits real audit rows for start, stop, rotate, lru-evict, and redacted export through the runtime audit logger sink.
  - Stdout event persistence now uses queued append-only file-handle writes with periodic manifest flushes; stop/rotate/delete flush pending writes before closing handles.
  - Screenshot capture now uses `p-queue` with concurrency 1 and interval cap 1 so timer bursts do not overlap `BrowserWindow.capturePage()` or block stdout task-event recording.
  - Git diff capture now uses `simple-git@3.36.0` for branch, HEAD, `diff --stat`, and full `diff` reads instead of raw `execFile('git')` calls.
  - Stdout and stdin stream routing is already wired through `R8RuntimeService` to `recordingEngine.recordStdout()` and `recordingEngine.recordStdin()` with session/task filtering on the recording side.
verified_by:
  - pnpm -C devhub exec vitest run src/shared/feature-flags.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "default disabled states|spec-22 recording|recording engine"
  - pnpm -C devhub exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1
  - pnpm -C devhub exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1 -t "1GB sparse fixture"
known_boundaries:
  - A packaged Electron 60-second screenshot-frequency benchmark remains unclaimed in this slice.
  - A dedicated renderer recording browser UI remains owned by downstream recording/replay surfaces.
```

---

## 16. implementation_status_2026_05_18_streams_queue_lifecycle

```yaml
status: recording_engine_verified_for_spec_22
implemented:
  - Dedicated stream classes now exist under `src/main/services/recording/streams/` for stdout, stdin, screenshot, fs, and git-diff NDJSON streams.
  - `RecordingService` routes append-only stream writes through those stream classes, flushes them on stop/rotate/delete, and recreates fresh stream objects after rotation.
  - `StoreBackedTaskQueueService.attachRecording()` persists the real `recordingId` back onto the task run without faking executor success or adding a state transition.
  - `R8RuntimeService` observes real task queue state transitions and automatically starts recording when a UUID-backed task enters `running`.
  - `R8RuntimeService` automatically stops the same recording when that task leaves `running` through success, failure, retry, cancellation, skip, or awaiting-human paths.
  - Task recording start uses the real `RecordingService.start()` path with `source: csv-batch`, the task cwd, task id, task tool, and the same runtime stream feature-flag filtering as manual recording.
  - Task recording stop waits for any in-flight async recording start before calling the real `RecordingService.stop()`, preventing early completion from dropping the stop event.
  - stdout routing now also matches active recordings by `payload.taskId`, preserving capture when task queue session identifiers and CLI session identifiers differ.
verified_by:
  - pnpm -C devhub typecheck
  - pnpm -C devhub exec eslint src/main/services/recording/RecordingService.ts src/main/services/recording/RecordingService.test.ts src/main/services/recording/streams/RecordingEventStream.ts src/main/services/recording/streams/StdoutStream.ts src/main/services/recording/streams/StdinStream.ts src/main/services/recording/streams/ScreenshotStream.ts src/main/services/recording/streams/FsStream.ts src/main/services/recording/streams/GitDiffStream.ts src/main/services/recording/streams/index.ts src/main/services/task-queue/TaskQueueService.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts --max-warnings=0
  - pnpm -C devhub exec vitest run src/main/services/recording/RecordingService.test.ts --maxWorkers=1
  - pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "recording|task queue sessions"
  - pnpm -C devhub exec vitest run src/main/services/task-queue/TaskQueueService.test.ts --maxWorkers=1
remaining_boundaries:
  - Packaged Electron 60-second screenshot-frequency proof remains a release-level benchmark, not a spec-22 source-code blocker.
  - Dedicated renderer browsing UI remains downstream UX scope; spec-22 engine and queue lifecycle are complete.
```
