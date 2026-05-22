# R8.C spec-01 — CLIOutputParser 总框架

> **batch**: R8.C  |  **priority_in_batch**: #1（基础设施）  |  **flag**: `R8.C.cli.parser`
> **depends_on**: R8.A spec-01 (integration-libs) + R8.A spec-02 (ProcessUnifiedVM) + R8.C spec-33 (Zod SoT)
> **blocks**: spec-02/03/04/05（各家 SHIM 子类）+ spec-27（信号融合）+ spec-07（监控窗口）
> **decision_anchor**: V1-Q-7.B.1 答 C 启发式+CLI 真实+置信度区间 / V1-Q-10.C.2 答 D 多策略 / feedback#4 进度迟漏报
> **estimated_loc**: 1200
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_7_b_1: "C — 启发式 + CLI 真实输出 混合，置信度区间"
user_quote_v1_q_10_c_2: "D 多策略（逐行 + JSON 流 + 自定义 SHIM 协议，按工具自动选择）"
feedback_4: "AI 编程窗口感测无效，运行中显示空闲，误报/瞎报/错报 + 监控进度迟报漏报"
pain_point: "AITaskTracker 6 信号 + 硬编码 8 阶段映射（idle=0%/thinking=30%/coding=68%/...），进度与真实 CLI 输出脱钩"

goals:
  - 抽象统一 IParser 接口，屏蔽各 CLI 差异
  - 4 种解析策略（NDJSON / SHIM / line-based / SSE），每家 CLI 通过 ParserRegistry 选最优策略
  - 输出 CliEventSchema（master §3.1）写入统一管线（→ spec-27 SignalFusion 信号源 cli_parse 高权重）
  - 进度数据点 ProgressDataPointSchema 必含 source ∈ {cli-real, heuristic, fusion} + confidence
  - 主框架 600 LoC + 4 家 SHIM 子类（spec-02..05）+ 自动检测 spec-06
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts
  - devhub/src/main/services/cli-parser/IParser.ts
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/main/services/cli-parser/StreamMultiplexer.ts
  - devhub/src/main/services/cli-parser/strategies/NdjsonStrategy.ts
  - devhub/src/main/services/cli-parser/strategies/ShimStrategy.ts
  - devhub/src/main/services/cli-parser/strategies/LineBasedStrategy.ts
  - devhub/src/main/services/cli-parser/strategies/SseStrategy.ts
  - devhub/src/main/services/cli-parser/CLIOutputParser.test.ts
  - devhub/src/shared/schemas/cli-event.ts  # CliEventSchema (master §3.1)
  - devhub/src/shared/schemas/progress-data-point.ts  # ProgressDataPointSchema
modified_files:
  - devhub/src/main/services/AITaskTracker.ts  # subscribe CliEvent → 注入 SignalCollector
  - devhub/src/main/services/detection/SignalCollector.ts  # 新增 cli_parse 信号源（高权重 0.8）
  - devhub/src/main/ipc/aiTaskHandlers.ts  # 新增 ai:parse-stream subscribe
  - devhub/src/main/index.ts  # 启动时实例化 CLIOutputParser 单例
glob_anchors:
  - devhub/src/main/services/AITaskTracker.ts:1-200  # init/signals 入口
  - devhub/src/shared/types-extended.ts  # PhaseSignals / ProgressEstimate
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { CliEventSchema, type CliEvent } from '@/shared/schemas/cli-event'
import { ProgressDataPointSchema, type ProgressDataPoint } from '@/shared/schemas/progress-data-point'

export const ParserStrategyEnum = z.enum(['ndjson', 'shim', 'line', 'sse'])

export const ParserDescriptorSchema = z.object({
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']),
  strategy: ParserStrategyEnum,
  priority: z.number().int().min(0).max(100),  // 多策略时高优先生效
  enabled: z.boolean().default(true),
})
export type ParserDescriptor = z.infer<typeof ParserDescriptorSchema>

export interface IParser {
  readonly descriptor: ParserDescriptor
  parseChunk(chunk: Buffer | string): CliEvent[]
  estimateProgress(events: CliEvent[]): ProgressDataPoint | null
  reset(): void
  dispose(): void
}

export const ParseSessionSchema = z.object({
  sessionId: z.string().uuid(),
  instanceId: z.string(),
  tool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']),
  strategy: ParserStrategyEnum,
  startedAt: z.number().int(),
  bytesProcessed: z.number().int().nonnegative(),
  eventsEmitted: z.number().int().nonnegative(),
  lastEventAt: z.number().int().nullable(),
})
export type ParseSession = z.infer<typeof ParseSessionSchema>
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  cli:event-stream:
  direction: main->renderer
  streaming: true
  payload: CliEvent
  cli:get-sessions:
  req: {}
  resp: ParseSession[]
  cli:get-progress:
  req: { instanceId: string }
  resp: ProgressDataPoint | null
  cli:install-shim:
  req: { tool: 'codex'|'claude'|'gemini' }
  resp: { success: boolean, shimPath: string }
  cli:select-strategy:
  req: { instanceId: string, strategy: ParserStrategy }
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 解析非法 JSON | E_VALIDATION |
| stream 已断开 | E_NOT_FOUND |
| 限流命中 | E_RATE_LIMITED |
| SHIM 未安装时选 shim 策略 | E_SHIM_NOT_INSTALLED |
| 未知 tool | E_VALIDATION |
| 解析吞吐 < 200 行/s | E_TIMEOUT（warn） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (NDJSON 路径):
  given: claude --output-format=stream-json 已启动，输出 NDJSON 事件流
  when: NdjsonStrategy 接收 ≥ 5 行 chunk
  then: emit ≥ 5 CliEvent，type 字段覆盖 ['start','progress','tool-use','message-out','completion'] 至少 3 种

GWT-2 (line-based 兜底):
  given: 工具无 JSON 流，仅 ASCII stdout
  when: LineBasedStrategy 接收 stdout，含正则 /^Step (\d+)\/(\d+)/
  then: emit CliEvent type=progress payload.step=N total=M

GWT-3 (SHIM 路径):
  given: 用户已 cli:install-shim → 路径已注入 child env
  when: 用户启动 codex 命令
  then: ShimStrategy 接管 stdio，emit CliEvent rawSource='shim'

GWT-4 (Zod 校验失败):
  given: NDJSON 中混入非法 JSON
  when: parseChunk
  then: 捕获错误，emit CliEvent type='unknown' confidence ≤ 0.2，写入 audit log，不崩

GWT-5 (置信度合并):
  given: 同一 instanceId 同时有 line + shim 两源
  when: estimateProgress
  then: 输出 source='fusion'，percent = weighted avg，confidence = max(c_line, c_shim)
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-01-cli-parser.spec.ts
test('GWT-1 NDJSON parse claude stream-json', async ({ page, electronApp }) => {
  await electronApp.evaluate(({ ipcMain }, fixture) => {
  const fs = require('fs')
  const stream = fs.createReadStream(fixture)
  ipcMain.emit('test:feed-cli-stream', { tool: 'claude', stream })
  }, './fixtures/claude-stream-sample.ndjson')
  const events = await page.evaluate(() => new Promise<any[]>(resolve => {
  const got: any[] = []
  window.electronAPI.cli.eventStream.subscribe((e: any) => {
  got.push(e)
  if (got.length >= 5) resolve(got)
  })
  }))
  expect(events.length).toBeGreaterThanOrEqual(5)
  const types = new Set(events.map((e: any) => e.type))
  expect(types.size).toBeGreaterThanOrEqual(3)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'execa@9.5':  spawn 子进程，捕获 stdio
  - 'node-pty@10.x':  交互式 PTY（V1-Q-10.C.1 答 D node-pty + execa 混合）
  - 'split2@4.2':  line/NDJSON 切分
  - 'eventsource-parser@1.1':  SSE 解析（Anthropic / OpenAI 备用）

inspirations:
  - LangSmith stdout structured logging
  - Anthropic Claude Code stream-json schema
  - GNU make jobserver 协议（信号管线灵感）
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~600
modified_loc: ~150
test_loc: ~400
total: ~1150
risk_areas:
  - AITaskTracker 注入点（不破坏旧 6 信号路径）
  - SignalCollector 新加 cli_parse 通道（spec-27 消费）
```

---

## 10. implement_checklist

- [x] 实现 IParser 接口 + 4 个 strategy 子类（每个 ≤ 150 LoC）
- [x] ParserRegistry 按 (tool, strategy) 注册 + lookup
- [x] StreamMultiplexer 把同一 instanceId 的多源输出合并
- [x] CliEventSchema / ProgressDataPointSchema 写入 `src/shared/schemas/r8-runtime.ts`（spec-33 SoT 约束）
- [x] AITaskTracker 订阅 CliEvent 流，写入 SignalCollector（2026-05-11: `CLIOutputParser.subscribe()` → `R8RuntimeService` 共享 tracker 接线 → `AITaskTracker.ingestCliOutputEvent()` → `collectDetectionSignals(cli_parse)`，由定向 Vitest + typecheck 验证）
- [x] r8RuntimeHandlers 注册 cli:event-stream / cli:get-sessions / cli:get-progress / cli:install-shim / cli:select-strategy，并通过 preload 暴露
- [x] vitest 覆盖 5 GWT；fixture 含真实采样的 NDJSON / line / SSE 样本
- [x] feature flag R8.C.cli.parser 默认 ON
- [x] audit log 每次 strategy 切换写一条
- [x] 限流：parseChunk 回写至 IPC 时复用 spec-31 token bucket（high_freq_scan 通道）

---

## 11. dependencies

```yaml
upstream:
  - R8.A spec-01: execa / node-pty / split2 已安装
  - R8.A spec-02: ProcessUnifiedVM 给出 PID + cmdline 用于检测 tool 类型
  - R8.C spec-33: CliEventSchema 写入共享 SoT
downstream:
  - R8.C spec-02 / 03 / 04 / 05: 各家 SHIM 子类继承 IParser
  - R8.C spec-06: cli:install-shim 由它调
  - R8.C spec-07: 监控窗口订阅 cli:event-stream
  - R8.C spec-27: SignalFusion 消费 cli_parse 信号
```

---

## 12. fallback_strategy

```yaml
on_strategy_fail:
  - ndjson 失败 → 自动降级到 line-based + WARN 通知
  - shim 不可用 → 降级到 line-based + 提示用户运行 cli:install-shim
  - line 模式正则未命中 → emit type='unknown' confidence=0.1，不影响其他信号
on_high_volume_overflow:
  - parseChunk 队列堆积 > 1000 时丢弃 type='unknown' 事件优先
flag_off_behavior:
  - R8.C.cli.parser=OFF 时 AITaskTracker 退回 R7 6 信号路径，不引入回归
```

---

## 13. performance_budget

```yaml
parse_lines_per_sec: { warn: 1000, fatal: 200 }  # master §7.4
parse_chunk_p99_ms: 5
event_emit_p95_ms: 2
memory_per_session_kb: { warn: 256, fatal: 1024 }
total_sessions_max: 16  # 与 task_queue concurrent_max 对齐
ipc_channel: cli:event-stream → spec-31 medium_query 60 RPM
```

---

## 14. Implementation Evidence — 2026-05-04

```yaml
status: partial_verified
implemented_files:
  - devhub/src/main/services/cli-parser/IParser.ts
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/main/services/cli-parser/StreamMultiplexer.ts
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts
  - devhub/src/main/services/cli-parser/strategies/NdjsonStrategy.ts
  - devhub/src/main/services/cli-parser/strategies/ShimStrategy.ts
  - devhub/src/main/services/cli-parser/strategies/LineBasedStrategy.ts
  - devhub/src/main/services/cli-parser/strategies/SseStrategy.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
verified_gwt:
  GWT-1: NDJSON emits five events and at least three event types
  GWT-2: line Step N/M emits progress plus payload.step and payload.total
  GWT-3: SHIM emits rawSource=shim
  GWT-4: malformed NDJSON emits unknown with confidence <= 0.2 and does not throw
  GWT-5: line plus shim progress fuses to source=fusion with weighted percent
no_mock_boundary:
  - parser consumes real chunks, not fixture-only fake success
  - shim install writes a real shim file path and does not claim external CLI execution
  - malformed input is represented as low-confidence runtime data
verification:
  targeted_tests: 4 files / 35 tests passed
  typecheck: passed
  lint_no_emoji: passed, No emoji found in 264 files
  full_vitest: 51 files / 468 tests passed
  license: passed
  gitnexus: CLIOutputParser LOW, R8RuntimeService LOW, setupR8RuntimeHandlers LOW
closed_by_later_evidence_2026_05_14:
  - packaged_Electron_e2e_for_cli_event_stream
global_release_gate_not_spec_local:
  - fresh_full_vitest_after_2026_05_06_preload_bridge_update
```

---

## 15. Implementation Update — 2026-05-06

```yaml
status: partial_verified
added:
  - devhub/src/preload/index.ts exposes cli:get-sessions, cli:install-shim, cli:select-strategy, and cli:event-stream subscription.
  - devhub/src/renderer/types/global.d.ts mirrors the full public CLI parser bridge.
  - prompts/0421/contracts/23-ipc-contracts-master.md includes the new public preload whitelist entries.
verified_commands:
  - pnpm -C devhub test --run src/preload/preloadContract.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
  - pnpm -C devhub test --run src/main/services/cli-parser/CLIOutputParser.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1
  - pnpm -C devhub lint
  - pnpm -C devhub check:zod-sot
verification_results:
  preload_contract: 1 file / 4 tests passed
  parser_runtime_suite: 4 files / 98 tests passed
  typecheck: passed
  lint_no_emoji: passed, No emoji found in 573 files
  zod_sot: passed
closed_by_later_evidence_2026_05_14:
  - packaged_Electron_e2e_for_cli_event_stream
global_release_gate_not_spec_local:
  - fresh_full_vitest_after_2026_05_06_preload_bridge_update
```

---

## 16. Implementation Update — 2026-05-11

```yaml
status: partial_verified
closed:
  - AITaskTracker_direct_CliEvent_subscription_to_SignalCollector
added:
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts exposes a bounded subscriber API and publishes parsed real events only after schema validation.
  - devhub/src/main/services/R8RuntimeService.ts wires its parser into the shared runtime AITaskTracker when the real app runtime provides one.
  - devhub/src/main/services/AITaskTracker.ts ingests CliOutputEvent payloads, maps progress into task phase/progress state, caches fresh cli_parse samples, and passes cli_parse into SignalCollector without removing legacy six-signal heuristics.
  - devhub/src/main/services/detection/SignalCollector.ts adds cli_parse as an explicit weighted event signal while preserving terminal/window/process signals.
verified_commands:
  - pnpm -C devhub test --run src/main/services/AITaskTracker.test.ts src/main/services/detection/DetectionEngine.test.ts src/main/services/R8RuntimeService.test.ts src/main/services/cli-parser/CLIOutputParser.test.ts --maxWorkers=1
  - pnpm -C devhub typecheck
  - pnpm -C devhub check:zod-sot
  - pnpm -C devhub check:no-cloud-deps
  - pnpm -C devhub check:no-ocr-deps
  - pnpm -C devhub check:no-emoji
  - pnpm -C devhub lint
verification_results:
  targeted_parser_tracker_runtime_suite: 4 files / 124 tests passed
  typecheck: passed
  zod_sot: passed
  no_cloud_deps: passed
  no_ocr_deps: passed
  no_emoji: passed, No emoji found in 593 files
  lint: passed
closed_by_later_evidence_2026_05_14:
  - packaged_Electron_e2e_for_cli_event_stream
global_release_gate_not_spec_local:
  - full_vitest_after_current_R8_dirty_worktree_is_stabilized
```

---

## 17. Implementation Evidence — 2026-05-14 Packaged CLI Event Stream E2E Closure

```yaml
status: verified_packaged_cli_event_stream_e2e
implemented_now:
  - devhub/src/main/ipc/index.ts
  - devhub/src/main/index.ts
  - devhub/e2e/example.spec.ts
verified_now:
  packaged_event_stream:
  - Playwright launches the production-built Electron main entry `out/main/index.js`
  - the renderer subscribes through the public preload bridge `window.devhub.r8.cli.onEvent`
  - the main-process runtime test hook feeds a real Claude `stream-json` shaped assistant event into `R8RuntimeService.parseCliChunk`
  - `ClaudeParser` validates the payload through the real shared Claude stream schema and emits a `CliOutputEvent` with `eventType=progress_pct` and `rawSource=ndjson`
  - the packaged renderer receives the parsed `cli:event-stream` payload for the same `instanceId`
  packaged_progress_and_session:
  - `window.devhub.r8.cli.getProgress({ tool: "claude", instanceId })` returns the stored parsed event
  - progress is computed from real usage tokens as `percent=0.2`, `source=cli-real`, and `confidence=0.7`
  - `window.devhub.r8.cli.getSessions()` returns the persisted parse session with `eventsEmitted=1`, `strategy=ndjson`, and `tool=claude`
  no_mock_boundary:
  - no synthetic renderer event is sent directly
  - no fake IPC success response is fabricated
  - the E2E path uses the real packaged main process, real `R8RuntimeService`, real parser registry, real `ClaudeParser`, real preload bridge, and real renderer event listener
validation:
  gitnexus_impact: npx gitnexus impact --repo devhub --direction upstream --include-tests --depth 2 DevhubRuntimeTestHooks && npx gitnexus impact --repo devhub --direction upstream --include-tests --depth 2 RuntimeTestHooks
  eslint_initial: pnpm -C devhub exec eslint src/main/index.ts src/main/ipc/index.ts e2e/example.spec.ts
  typecheck_initial: pnpm -C devhub exec tsc --noEmit --pretty false
  build: pnpm -C devhub build
  packaged_playwright: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-01" --workers=1 --reporter=line
remaining_not_claimed_done: []
```
