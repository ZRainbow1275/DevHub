# spec-04-shim-gemini-stdout — Gemini CLI stdout + SHIM（C+D 路线）

> **batch**: R8.C  |  **flag**: `R8.C.shim.gemini`
> **depends_on**: R8.C.spec-01, R8.C.spec-02 (SHIM infra reuse), R8.C.spec-06
> **derives_from**: V1-Q-7.B.2 答 Gemini CLI = C+D（stdout 解析 + SHIM）
> **estimated_loc**: 1100
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_7_b_2: "Gemini CLI: C — 解析 stdout + D — SHIM 注入 进度回调"
pain_point: "Gemini CLI 默认输出夹杂 ANSI 控制符 + 半结构化 markdown，难以直接判断阶段"
goals:
  - LineBasedStrategy 复用 + 自定义正则匹配 Gemini stdout 模式
  - SHIM 路线：注入 GEMINI_OUTPUT_FORMAT=json env（如官方支持）或 marker 协议（不支持时）
  - 输出 CliEvent 与 master §3.1 schema 对齐
market_alignment_2026:
  - Gemini CLI 2026 Q1 路线图含 --json 选项；当前主版本仅 stdout
  - 故 SHIM 当前以 marker 协议为主，stdout 解析为次
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.ts
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.test.ts
  - devhub/src/main/services/shim/GeminiShimInstaller.ts
  - shim/gemini/gemini-shim.ts
  - shim/gemini/gemini-shim.test.ts
  - devhub/src/shared/schemas/gemini-pattern.ts
modified_files:
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/main/services/shim/ShimRegistry.ts
glob_anchors:
  - devhub/src/main/services/cli-parser/strategies/LineBasedStrategy.ts:1-150
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { CliEventSchema } from '@/shared/schemas/cli-event'

export const GeminiPatternKindEnum = z.enum([
  'thinking',
  'tool_call',
  'tool_result',
  'partial_text',
  'completion',
  'rate_limit',
  'safety_block',
  'unknown',
])

export const GeminiPatternRuleSchema = z.object({
  kind: GeminiPatternKindEnum,
  regex: z.string(),  // ECMA regex
  flags: z.string().default('m'),
  confidence: z.number().min(0).max(1),
  ansiStrip: z.boolean().default(true),
})
export type GeminiPatternRule = z.infer<typeof GeminiPatternRuleSchema>

export const GeminiParseStateSchema = z.object({
  instanceId: z.string(),
  lastKind: GeminiPatternKindEnum.nullable(),
  toolStack: z.array(z.string()),
  partialBuffer: z.string(),
  totalLines: z.number().int().nonnegative(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  shim:install:  # 复用 spec-02
  req: { tool: 'gemini' }
  ai:gemini-pattern-stat:
  req: { instanceId: string }
  resp: { kindCounts: Record<GeminiPatternKind, number>, unmatchedRatio: number }
  ai:gemini-rule-reload:
  req: { rules: GeminiPatternRule[] }
  resp: { success: boolean, applied: number }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 用户未安装 gemini | E_CLI_NOT_FOUND |
| stdout 全 unmatched > 80% | E_VALIDATION (warn 提示规则失效) |
| SHIM 注入失败 | E_SHIM_NOT_INSTALLED |
| 正则编译错 | E_VALIDATION |
| ANSI strip 抛错 | E_INTERNAL（兜底原文） |
| 无 stdout > 30s | E_TIMEOUT |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础匹配):
  given: gemini stdout 输出 "Thinking..." 行
  when: GeminiParser 应用 thinking 规则
  then: emit CliEvent type='progress' phase='thinking' confidence=0.85

GWT-2 (工具调用):
  given: stdout 含 "[tool: read_file] path=..."
  when: GeminiParser 匹配 tool_call 规则
  then: emit CliEvent type='tool-use' payload.tool='read_file'

GWT-3 (SHIM 注入):
  given: 用户已 cli:install-shim tool=gemini
  when: 启动 gemini 命令
  then: SHIM 注入环境变量，命名管道 stdout frame 进入 GeminiParser line strategy 并转发 cli:event-stream

GWT-4 (规则热更新):
  given: 用户编辑 gemini-pattern.json 加新规则
  when: ai:gemini-rule-reload IPC 触发
  then: GeminiParser 立即应用新规则不重启

GWT-5 (兜底):
  given: 长时间无任何匹配
  when: 解析窗口 60s 超时
  then: emit CliEvent type='unknown' confidence=0.1 + warn audit log
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-2 gemini tool_call detection', async ({ page, electronApp }) => {
  await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.emit('test:feed-gemini-stdout', '[tool: read_file] path=/x/y\n')
  })
  const ev = await page.evaluate(() => new Promise(r => {
  window.electronAPI.cli.eventStream.subscribe((e: any) => {
  if (e.type === 'tool-use') r(e)
  })
  }))
  expect(ev.payload.tool).toBe('read_file')
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'strip-ansi@7.1':  ANSI 控制符剥离
  - 'split2@4.2':  行切分
  - 're2@2.x (optional)':  防 ReDoS
inspirations:
  - VS Code task problem matcher
  - tig (git log parser)
  - chalk + ANSI escape spec
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~550
modified_loc: ~80
test_loc: ~400
total: ~1030
risk_areas:
  - 正则规则维护成本（Gemini 升级时需更新）
  - SHIM 重复路径与 codex/claude 冲突时的安装序列
```

---

## 10. implement_checklist

- [x] LineBasedStrategy + Gemini 规则集（≥ 8 条）
- [x] gemini-shim 透传 + marker 注入
- [x] regex 在 main 启动时预编译，缓存 lastIndex
- [x] ANSI strip 默认 ON，失败回退原文
- [x] 规则热更新通过 IPC + 文件监听 (chokidar)
- [x] GeminiParseState 写入 SignalCollector cli_parse 通道
- [x] vitest 覆盖 5 GWT + 异常 ANSI / 超长行
- [x] feature flag R8.C.shim.gemini 默认 ON（gemini 已检测到时）
- [x] audit log: 规则匹配率 < 50% 时 WARN

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-01: IParser / LineBasedStrategy
  - R8.C.spec-02: SHIM infra
  - R8.C.spec-06: CLI 检测识别 gemini 版本
downstream:
  - R8.C.spec-07: monitor window 显示 Gemini 阶段
  - R8.C.spec-27: SignalFusion 消费
```

---

## 12. fallback_strategy

```yaml
on_pattern_mismatch:
  - 匹配率 < 50% 时退回 generic LineBasedStrategy
  - 用户可一键回滚到上一规则版本
on_shim_collision:
  - 与 codex/claude SHIM 路径冲突时按 priority 字段决定
flag_off_behavior:
  - R8.C.shim.gemini=OFF 时退回 R7 信号路径
```

---

## 13. performance_budget

```yaml
regex_match_p99_us: { warn: 200, fatal: 1500 }
ansi_strip_p99_us: { warn: 100, fatal: 800 }
unmatched_ratio_threshold: 0.5
memory_per_session_kb: { warn: 256, fatal: 1024 }
ipc_channel: ai:gemini-pattern-stat → spec-31 medium_query 60 RPM
```

---

## 14. Implementation Evidence — 2026-05-04 Parser Foundation

```yaml
status: partial_verified
implemented_now:
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.ts
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.test.ts
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/shared/schemas/r8-runtime.ts
verified_gwt_subset:
  thinking: Gemini stdout Thinking... emits eventType=progress phase=thinking confidence=0.85
  tool_call: '[tool: read_file]' emits eventType=tool-use payload.tool=read_file
  ansi_strip: parser strips ANSI through runtime-built RegExp without source control regex lint violations
not_claimed_done:
  - SHIM environment injection and PATH installation
  - ai:gemini-rule-reload hot reload
verification:
  targeted_tests: parser suite passed
  full_vitest: 53 files / 472 tests passed
  typecheck: passed
  lint_no_emoji: passed
  gitnexus: GeminiParser LOW risk
```

## 15. Implementation Evidence - 2026-05-04 Gemini Rule Hot Reload And Stats

```yaml
status: partial_verified_executable_parser
implemented_now:
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.ts
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.test.ts
  - devhub/src/main/services/cli-parser/CLIOutputParser.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
verified_gwt_subset:
  thinking: stdout Thinking... emits eventType=progress phase=thinking confidence=0.85
  tool_call: '[tool: read_file]' emits eventType=tool-use payload.tool=read_file
  rule_hot_reload: ai:gemini-rule-reload applies new regex rules without process restart after confirmedBy
  pattern_stats: ai:gemini-pattern-stat returns per-instance kindCounts, totalLines, unmatchedLines, unmatchedRatio, ruleVersion, and appliedRules
  ansi_strip: ANSI stripping remains implemented with runtime-built RegExp
not_claimed_done:
  - PATH-level Gemini shim environment injection
verification:
  targeted_tests: GeminiParser, R8RuntimeService, and r8RuntimeHandlers passed with --maxWorkers=1
  typecheck: passed
```

## 16. Implementation Evidence - 2026-05-06 Shared Schema + Defensive Stdout Slice

```yaml
status: partial_verified_schema_and_stdout_hardening
implemented_now:
  - devhub/src/shared/schemas/gemini-pattern.ts
  - devhub/src/shared/schemas/index.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.ts
  - devhub/src/main/services/cli-parser/parsers/GeminiParser.test.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.test.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - prompts/0421/contracts/23-ipc-contracts-master.md
  - devhub/docs/r8/gemini-stdout-parser.md
verified_gwt_subset:
  rule_set: GeminiParser now has eight default precompiled rules across thinking, two tool-call formats, tool_result, completion, rate_limit, safety_block, and partial_text.
  stdout_matching: Thinking... emits eventType=progress phase=thinking confidence=0.85.
  tool_call: '[tool: read_file]' and 'Running tool: read_file' both emit eventType=tool-use with payload.tool.
  defensive_input: ANSI sequences are stripped with fallback, oversized lines are bounded before matching, and partial buffers remain capped.
  ipc_public_bridge: ai:gemini-pattern-stat and ai:gemini-rule-reload are exposed through preload/global types and the whitelist contract.
  zod_sot: GeminiPatternKind, GeminiPatternRuleInput, GeminiParseState, GeminiPatternStatRequest, GeminiPatternStat, GeminiRuleReloadRequest, and GeminiRuleReloadResponse are registered in the runtime schema registry.
not_claimed_done:
  - packaged Electron Playwright E2E
verification:
  focused_tests: 4 files / 10 tests passed; CLIOutputParser was skipped by the focused testNamePattern.
  typecheck: passed
  lint_no_emoji: passed; No emoji found in 575 files.
  zod_sot: passed
  gitnexus_impact:
  GeminiParser: LOW risk; direct importer parsers/index.ts, indirect ParserRegistry and CLIOutputParser.
  CLIOutputParser: LOW risk; direct importer R8RuntimeService and cli-parser/index.ts.
```

## 17. Implementation Evidence - 2026-05-15 Gemini Low Match WARN Audit

```yaml
status: partial_verified_warn_audit
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
verified_gwt_subset:
  low_match_warn: real Gemini stdout lines parsed through R8RuntimeService now emit one local audit row when matchRatio < 0.5 after at least 5 observed lines.
  no_spam: audit key is instanceId + Gemini parser ruleVersion, so additional unmatched lines in the same rule version do not create repeated audit rows.
  audit_payload: action ai:gemini-pattern-low-match-rate records severity WARN, instanceId, sessionId, totalLines, unmatchedLines, unmatchedRatio, matchRatio, threshold, ruleVersion, appliedRules, lastKind, and partialBufferBytes.
not_claimed_done:
  - packaged Electron Playwright E2E
verification:
  targeted_tests: pnpm -C devhub test --run src/main/services/cli-parser/parsers/GeminiParser.test.ts src/main/services/R8RuntimeService.test.ts -t "Gemini" --maxWorkers=1 passed; 2 files passed, 9 tests passed.
  touched_eslint: pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts passed.
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false passed.
  no_emoji: pnpm -C devhub check:no-emoji passed; No emoji found in 622 files.
  zod_sot: pnpm -C devhub check:zod-sot passed.
  gitnexus_impact:
  GeminiParser: LOW risk.
  R8RuntimeService: LOW risk.
```

## 18. Implementation Evidence - 2026-05-15 Gemini Feature Flag Default

```yaml
status: partial_verified_feature_flag_default
implemented_now:
  - devhub/src/shared/feature-flags.test.ts
verified_gwt_subset:
  flag_registry: R8.C.shim.gemini is present in the shared feature flag registry with status enabled, defaultEnabled true, and dependsOn R8.C.cli.parser.
  default_eval: isFeatureEnabled('R8.C.shim.gemini') returns true without user override, so a detected Gemini CLI keeps the Gemini stdout parser/shim gate enabled by default.
not_claimed_done:
  - packaged Electron Playwright E2E
verification:
  targeted_tests: pnpm -C devhub test --run src/shared/feature-flags.test.ts --maxWorkers=1 passed; 1 file passed, 3 tests passed.
  gitnexus_impact:
  R8C_FEATURE_FLAGS: target not indexed by GitNexus; fallback was focused source inspection and targeted feature-flag Vitest.
```

## 19. Implementation Evidence - 2026-05-15 Gemini SignalCollector cli_parse

```yaml
status: partial_verified_signal_collector
implemented_now:
  - devhub/src/main/services/AITaskTracker.test.ts
verified_gwt_subset:
  gemini_cli_parse_signal: real Gemini stdout parsed by CLIOutputParser through GeminiParser is delivered through AITaskTracker.subscribeToCliOutputParser into SignalCollector as activeIndicators includes cli_parse.
  progress_bridge: Gemini Thinking... preserves progressEstimate percentage 25 and confidence 0.85 on the matched AITask without replacing legacy signal contributions.
not_claimed_done:
  - packaged Electron Playwright E2E
verification:
  targeted_tests: pnpm -C devhub test --run src/main/services/AITaskTracker.test.ts -t "CLI parser subscription|Gemini" --maxWorkers=1 passed; 1 file passed, 2 tests passed.
  gitnexus_impact:
  AITaskTracker: MEDIUM risk because it feeds multiple runtime/import paths; no production source change was made.
  collectDetectionSignals: LOW risk.
```

## 20. Implementation Evidence - 2026-05-15 Gemini Rule File Watcher

```yaml
status: partial_verified_rule_file_watcher
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
verified_gwt_subset:
  ipc_reload: ai:gemini-rule-reload remains the confirmed explicit runtime reload path.
  file_watcher: startGeminiRuleWatcher starts a real chokidar watcher for userData/gemini-pattern.json, reads actual JSON from disk, accepts either an array or { rules: [] }, and reuses reloadGeminiRules with confirmedBy gemini-pattern-watcher.
  watcher_audit: add/change/initial/error/unlink watcher outcomes are locally audited without simulating Gemini process success.
  real_reload_test: writing gemini-pattern.json in Vitest increments parser ruleVersion and the new rule classifies real Gemini stdout "Awaiting Gemini plan" as thinking/progress with confidence 0.79.
not_claimed_done:
  - packaged Electron Playwright E2E
verification:
  targeted_tests: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "Gemini" --maxWorkers=1 passed; 1 file passed, 3 tests passed.
  gitnexus_impact:
  R8RuntimeService: LOW risk from earlier spec-04 runtime impact scan.
```

## 21. Implementation Evidence - 2026-05-15 Gemini SHIM Passthrough Marker

```yaml
status: partial_verified_gemini_shim
implemented_now:
  - devhub/src/main/services/shim/ShimRegistry.ts
  - devhub/src/main/services/shim/ShimRegistry.test.ts
verified_gwt_subset:
  passthrough: generated gemini-devhub-shim.mjs launches the real child command and preserves stdout/stderr passthrough.
  env_injection: Gemini shim child env receives GEMINI_OUTPUT_FORMAT=json when the user has not supplied it and DEVHUB_SHIM_MARKER_PROTOCOL=v1 for marker-aware execution.
  marker_protocol: generated shim emits DEVHUB::MARKER::v=1::DONE=... over the frame pipe after the real child exits.
  real_child_test: Vitest executes the generated Gemini shim against process.execPath, reads the real child stdout json:v1, captures the same stdout frame, and verifies the completion marker frame.
not_claimed_done:
  - packaged Electron Playwright E2E
verification:
  targeted_tests: pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts --maxWorkers=1 passed; 1 file passed, 4 tests passed.
```

## 22. Implementation Evidence - 2026-05-15 Gemini GWT Coverage Completion

```yaml
status: partial_verified_gwt_coverage
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
verified_gwt_subset:
  gwt_1_basic_match: GeminiParser.test covers Thinking... -> progress/thinking confidence 0.85.
  gwt_2_tool_call: GeminiParser.test covers bracket and prose tool-call stdout -> tool-use with payload.tool.
  gwt_3_shim_injection: ShimRegistry.test executes generated Gemini shim and verifies passthrough stdout, GEMINI_OUTPUT_FORMAT=json, DEVHUB_SHIM_MARKER_PROTOCOL=v1, and DONE marker frame.
  gwt_4_rule_reload: R8RuntimeService.test covers confirmed IPC-style reload and real gemini-pattern.json chokidar reload without DevHub restart.
  gwt_5_timeout_fallback: R8RuntimeService.checkGeminiStdoutTimeouts emits one system CliEvent eventType unknown with confidence 0.1 plus local WARN audit after the Gemini parse session exceeds the 30s stdout timeout.
  defensive_stdout: GeminiParser.test covers ANSI stripping and oversized-line bounding with capped partial buffer.
not_claimed_done:
  - packaged Electron Playwright E2E
verification:
  targeted_tests:
  - pnpm -C devhub test --run src/main/services/cli-parser/parsers/GeminiParser.test.ts src/main/services/R8RuntimeService.test.ts -t "Gemini" --maxWorkers=1 passed.
  - pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "Gemini" --maxWorkers=1 passed; 1 file passed, 4 tests passed.
  - pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts --maxWorkers=1 passed; 1 file passed, 4 tests passed.
```

## 23. Implementation Evidence - 2026-05-15 Packaged Electron Gemini SHIM E2E Closure

```yaml
status: verified
implemented_now:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
  - devhub/e2e/example.spec.ts
verified_gwt_subset:
  packaged_electron: Playwright launches the production-built Electron main process from out/main/index.js.
  real_generated_shim: The test installs the generated Gemini shim through window.devhub.r8.cli.installShim and executes the generated shim file with the real Node executable.
  env_injection: The child process receives GEMINI_OUTPUT_FORMAT=json and DEVHUB_SHIM_MARKER_PROTOCOL=v1, then prints json:v1 to stdout.
  named_pipe_bridge: The generated shim writes real stdout frames into the installed named pipe while preserving passthrough stdout.
  gemini_line_strategy: R8RuntimeService.installShim routes Gemini shim frames through strategy=line because GeminiParser is a line parser, while non-Gemini shim tools keep strategy=shim.
  event_stream: The renderer receives cli:event-stream events for Thinking... as progress/thinking, Running tool: read_file as tool-use, and json:v1 as message-out, all with rawSource=line and tool=gemini.
not_claimed_done: []
verification:
  unit_regression: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts src/main/services/shim/ShimRegistry.test.ts -t "shim|Gemini" --maxWorkers=1 passed; 2 files passed, 9 tests passed, 97 skipped.
  touched_eslint: pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts e2e/example.spec.ts passed.
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false passed.
  build: pnpm -C devhub build passed; existing Monaco dynamic/static import warning remains non-fatal.
  codex_regression_e2e: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-02 packaged Codex" --workers=1 --reporter=line passed; 1 test passed.
  gemini_packaged_e2e: pnpm -C devhub exec playwright test e2e/example.spec.ts -g "R8.C spec-04" --workers=1 --reporter=line passed; 1 test passed.
```
