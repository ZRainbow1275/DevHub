# spec-03-shim-claude-stream-json — Claude Code stream-json + SHIM（C+D 路线）

> **batch**: R8.C  |  **flag**: `R8.C.shim.claude`
> **depends_on**: R8.C.spec-01, R8.C.spec-02 (SHIM infra reuse)
> **derives_from**: 07.B.2 Claude Code = C + D 方案

---

## 1. motivation

```yaml
user_quote_07_B_2: "Claude Code: C + D — JSON 流（--output-format=stream-json）+ SHIM"
user_pain_point_六轮反馈: "运行中显示空闲 / 进度迟报 / 误报"
goal:
  - 默认尝试 --output-format=stream-json + --include-partial-messages（C 路线）
  - 如果用户没传该 flag，SHIM 自动注入（D 路线）
  - 解析 NDJSON 流：assistant_message / tool_use / tool_result / completion
  - 把 token usage / 模型选择 / partial message 都映射为 ParseEvent
```

Claude Code v0.2+ 提供 `--output-format=stream-json`：每条 NDJSON 行是一个事件。结合 `--include-partial-messages` 可拿到流式片段。SHIM 注入保证即使用户忘加 flag 也有结构化数据。

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.ts
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.test.ts
  - devhub/src/main/services/shim/ClaudeShimInstaller.ts
  - shim/claude/claude-shim.ts
  - shim/claude/build.config.json
  - devhub/src/shared/schemas/claude-stream.ts
modified_files:
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/main/services/shim/ShimRegistry.ts
```

---

## 3. data_contracts

```typescript
// claude-stream.ts — Anthropic Claude Code stream-json schema
export const ClaudeStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
  type: z.literal('system'),
  subtype: z.enum(['init','reset']),
  cwd: z.string(),
  session_id: z.string(),
  tools: z.array(z.string()),
  model: z.string(),
  }),
  z.object({
  type: z.literal('assistant'),
  message: z.object({
  id: z.string(),
  role: z.literal('assistant'),
  model: z.string(),
  content: z.array(z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('tool_use'), id: z.string(), name: z.string(), input: z.unknown() }),
  ])),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }).optional(),
  }),
  parent_tool_use_id: z.string().nullable().optional(),
  }),
  z.object({
  type: z.literal('user'),
  message: z.object({ role: z.literal('user'), content: z.array(z.unknown()) }),
  }),
  z.object({
  type: z.literal('result'),
  subtype: z.enum(['success','error_max_turns','error_during_execution']),
  is_error: z.boolean(),
  duration_ms: z.number().int(),
  total_cost_usd: z.number(),
  usage: z.object({ input_tokens: z.number(), output_tokens: z.number() }),
  result: z.string().optional(),
  }),
  z.object({
  type: z.literal('partial_assistant'),
  message: z.object({ content: z.array(z.unknown()) }),
  }),
]);

export type ClaudeStreamEvent = z.infer<typeof ClaudeStreamEventSchema>;
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  shim:install:  # 复用 spec-02
  req: { tool: 'claude' }
  ai:claude-stream-event:  # main → renderer，Claude 专属事件流
  payload: ClaudeStreamEvent
  rate_limit_class: medium_query
  ai:claude-cost-summary:  # 渲染层在监控窗口显示 token 用量
  req: { instanceId: string }
  resp: { totalInputTokens: number, totalOutputTokens: number, totalCostUsd: number, durationMs: number }
```

---

## 5. error_matrix

| condition | code | recovery |
|-----------|------|----------|
| stream-json 行 JSON.parse 失败 | E_VALIDATION | 写 ParseEvent type=error；继续解析下一行 |
| Zod 校验 ClaudeStreamEventSchema 失败 | E_VALIDATION | log + drop（防 future schema 兼容） |
| 用户用旧版 claude-code（无 stream-json） | E_DEPENDENCY_MISSING | SHIM 注入路线（D fallback） |
| SHIM 注入也无 stream-json 输出 | (退化) | 退化到 Codex 风格 marker（claude-shim 主动 emit） |
| `result.is_error=true` | (透传错误) | ParseEvent type=error + payload 含 subtype |
| partial_assistant 高频涌入 | E_RATE_LIMITED | 节流：每 instance 100ms 合并一次 |

---

## 6. acceptance_gwt

```gherkin
Given 用户启动 claude --output-format=stream-json -p "..."
When 真 claude 输出 NDJSON 流（init / assistant / tool_use / result）
Then DevHub 输出 ParseEvent 序列：phase_marker(thinking) → tool_invocation → progress_pct(估算) → completion
And 监控窗口显示 token usage 实时更新

Given 用户没加 stream-json flag
When SHIM 检测到无 NDJSON 输出
Then SHIM 自动重启 claude 并补上 --output-format=stream-json
And 用户收到 toast "已自动启用结构化解析"

Given partial_assistant 每 50ms 一帧
When ClaudeParser 节流到 100ms 合并
Then ai:claude-stream-event RPM <= 600

Given result.subtype="error_max_turns"
When ClaudeParser 解析
Then ParseEvent type=error payload.subtype="error_max_turns"
And NotificationService 推送 ERROR 级
```

---

## 7. e2e_playwright_draft

```typescript
test('claude stream-json full lifecycle', async ({ ipc }) => {
  const events: ParseEvent[] = [];
  ipc.subscribe('ai:parse-stream', e => events.push(e));
  await ipc.invoke('test:simulate-claude-stream', {
  instanceId: 'cl-1',
  lines: [
  '{"type":"system","subtype":"init","cwd":"/x","session_id":"s","tools":[],"model":"claude-opus-4-7"}',
  '{"type":"assistant","message":{"id":"m1","role":"assistant","model":"claude-opus-4-7","content":[{"type":"text","text":"hi"}],"usage":{"input_tokens":10,"output_tokens":2}}}',
  '{"type":"result","subtype":"success","is_error":false,"duration_ms":1200,"total_cost_usd":0.001,"usage":{"input_tokens":10,"output_tokens":2}}',
  ]
  });
  await expect.poll(() => events.find(e => e.type === 'completion')).toBeTruthy();
});
```

---

## 8. reference_impl

```yaml
libraries:
  - name: ndjson
  version: ^2.0.0
  license: BSD-3-Clause
  use: 流式 JSON 行解析
  - name: zod
  version: ^3.23.8
  license: MIT
  use: ClaudeStreamEvent 校验
patterns:
  - https://docs.anthropic.com/claude/docs/agent-skills (Anthropic Agent Skills 兼容性)
  - https://github.com/anthropics/claude-code (CLI 源码)
parser_pseudocode: |
  // ClaudeParser.ts
  parse(line, ctx) {
  let json;
  try { json = JSON.parse(line); } catch { return null; }
  const r = ClaudeStreamEventSchema.safeParse(json);
  if (!r.success) return { type: 'unknown', confidence: 0, ... };
  const ev = r.data;
  switch (ev.type) {
  case 'system': return { type: 'phase_marker', payload: { phase: 'thinking' }, confidence: 1 };
  case 'assistant': return ev.message.content.some(c => c.type === 'tool_use')
  ? { type: 'tool_invocation', payload: { tool: ... }, confidence: 0.95 }
  : { type: 'progress_pct', payload: { pct: estimateFromUsage(ev) }, confidence: 0.7 };
  case 'result': return ev.is_error
  ? { type: 'error', payload: { subtype: ev.subtype }, confidence: 1 }
  : { type: 'completion', payload: { durationMs: ev.duration_ms, costUsd: ev.total_cost_usd }, confidence: 1 };
  default: return null;
  }
  }
```

---

## 9. impact_radius_loc

```yaml
estimated_loc:
  ClaudeParser.ts: 320
  ClaudeShimInstaller.ts: 180
  claude-shim.ts: 200
  claude-stream.ts (zod): 120
  test: 400
  total_new: ~1220
modified_loc:
  ParserRegistry.ts: +15
  ShimRegistry.ts: +20
risk_level: MEDIUM (Claude 官方 schema 演进风险)
```

---

## 10. implement_checklist

- [x] ClaudeStreamEventSchema 严格 discriminated union
- [x] partial_assistant 100ms 节流（lodash.throttle 或自实现）
- [x] usage.tokens 累计写入 ai:claude-cost-summary
- [x] tool_use 触发 ParseEvent type=tool_invocation 含 name+input
- [x] result.is_error → NotificationService.publish ERROR — 2026-05-15 `R8RuntimeService` publishes a real unified `ERROR` notification for Claude `result.is_error=true` events while malformed/schema-invalid parser errors remain non-notifying parser diagnostics.
- [x] SHIM 路线：`claude -p/--print` 未显式指定 `--output-format` 时，packaged shim source 与 generated Node fallback 在首次 `spawn()` 前注入 `--output-format stream-json` + `--include-partial-messages`；显式 `--output-format json/text` 不被覆盖 — 2026-05-16 `ShimRegistry.test.ts` 真实执行 generated fallback 和 shared packaged source，使用 `process.execPath` 作为 wrapped child 检查实际 argv，不调用 Claude API；`pnpm -C devhub shim:verify:codex` 同步证明共享 shim source 未破坏 packaged Codex passthrough。
- [x] post-output fallback：真实 Claude 输出仍非 stream-json 时，生成待确认 live restart request，通过统一通知 toast/statusbar 暴露 `Restart with stream-json` action，确认后真实 `spawn()` 本地子进程并把 stdout/stderr 回灌 Claude parser — 2026-05-17 `R8RuntimeService.test.ts` 用真实 `process.execPath` child 验证未确认前不重启、确认后启动真实 pid、退出后解析 schema-valid result。
- [x] 用户授权弹窗：第一次自动重启必须经统一 notification popup/action 授权；`NotificationService.registerAction()` 绑定 `claude-stream-json-restart:<requestId>`，未点击 action 时只保持 `pending-confirmation`。
- [x] ClaudeParser 单测：5 种事件 + 异常 JSON
- [x] Playwright E2E：模拟 stream-json 流 — 2026-05-16 `devhub/e2e/example.spec.ts` 的 `R8.C spec-03` packaged Electron 测试通过真实 preload 订阅 `cli:event-stream` 与 `ai:claude-stream-event`，通过 main-process test hook 注入 schema-valid Claude NDJSON system/assistant tool_use/result 行，并验证 cost summary。
- [x] 兼容矩阵文档：Claude Code v0.1 / v0.2 / v0.3 — 2026-05-16 `devhub/docs/r8/claude-stream-json.md` 记录 npm registry snapshot、`0.2.9` npx help probe、本机 `2.1.111` help/version、官方 CLI reference corroboration，并明确 `0.1.x`/`0.3.x` 在 npm 当前版本列表中不存在，旧版 fallback 不伪装完成。
- [x] Schema 版本字段（防 future-break）— 2026-05-15 `src/shared/schemas/claude-stream.ts` 为 Claude stream events 增加默认 `schemaVersion=1` 的严格 Zod 字段，`ClaudeParser` 将版本透传到 CLI 事件 payload，`R8RuntimeService` 的 `ai:claude-stream-event` 也保留该字段；证据见 `src/main/services/cli-parser/parsers/ClaudeParser.test.ts`、`src/shared/schemas/r8-runtime.test.ts`、`src/main/services/R8RuntimeService.test.ts`

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-01 (IParser / ParseEvent)
  - R8.C.spec-02 (SHIM infra)
  - R8.C.spec-06 (CLI detection)
downstream:
  - R8.C.spec-27 (信号融合用 token usage 作为高权重信号)
  - R8.C.spec-32 (观测面板显示 cost)
external_deps:
  - Claude Code CLI v0.2+ (推荐)
  - 用户配置好 ANTHROPIC_API_KEY（DevHub 不存）
```

---

## 12. fallback_strategy

```yaml
on_no_stream_json_support:
  primary: SHIM 注入 --output-format=stream-json + --include-partial-messages
  fallback: claude-shim 主动注入 codex 风格 marker
on_schema_mismatch_future:
  primary: Zod 软校验 + log
  fallback: 退化到 generic JSON parser（接受未知字段）
on_high_partial_throughput:
  primary: 节流 100ms
  fallback: 抑制 partial_assistant，仅保留 assistant final
```

---

## 13. performance_budget

```yaml
budgets:
  ndjson_parse_p99_us:
  warn: 500
  fatal: 5000
  partial_throttle_ms: 100
  cost_summary_update_freq_hz: 5
  schema_validation_ms_per_event:
  warn: 0.5
  fatal: 5
ipc_class: medium_query
```

## 14. Implementation Evidence - 2026-05-04 ClaudeParser Executable Slice

```yaml
status: partial_verified_executable_parser
implemented_now:
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.ts
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.test.ts
  - devhub/src/main/services/cli-parser/ParserRegistry.ts
  - devhub/src/shared/schemas/r8-runtime.ts
verified_gwt_subset:
  lifecycle_mapping: system -> phase_marker, assistant tool_use -> tool_invocation, assistant usage -> progress_pct, result success -> completion
  error_mapping: result.is_error=true preserves payload.subtype
  malformed_json: invalid stream-json line emits eventType=error payload.subtype=invalid_stream_json and parser continues
  generic_ndjson_boundary: spec-01 generic NDJSON tests remain on tool=unknown so Claude stream-json error semantics do not regress generic parser behavior
not_claimed_done:
  - automatic restart of a live Claude process with --output-format=stream-json
  - toast notification for automatic stream-json enablement
  - partial_assistant 100ms throttle and cost summary IPC
verification:
  targeted_tests: 9 R8.C files / 56 tests passed
  typecheck: passed
```

## 15. Implementation Evidence - 2026-05-06 Strict Schema + Cost Stream Slice

```yaml
status: partial_verified_strict_schema_and_ipc
implemented_now:
  - devhub/src/shared/schemas/claude-stream.ts
  - devhub/src/shared/schemas/index.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.ts
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.test.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.test.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  - prompts/0421/contracts/23-ipc-contracts-master.md
  - devhub/docs/r8/claude-stream-json.md
verified_gwt_subset:
  strict_schema: Claude stream events now use a shared Zod discriminated union for system, assistant, user, result, and partial_assistant events.
  parser_mapping: system -> phase_marker, assistant tool_use -> tool_invocation with name/input/id, assistant usage -> progress_pct, result success -> completion.
  partial_throttle: partial_assistant frames are merged by instance with a 100ms window and emitted as message-out events.
  cost_summary: ai:claude-cost-summary returns totalInputTokens, totalOutputTokens, totalCostUsd, and durationMs from persisted real parser events.
  stream_bridge: parsed Claude NDJSON events are emitted to ai:claude-stream-event through the main window bridge.
  invalid_input: malformed JSON and schema-incomplete stream events produce explicit low-confidence parser errors.
not_claimed_done:
  - automatic restart of a live Claude process with --output-format=stream-json
  - first-run user authorization popup for automatic restart
  - Playwright E2E against packaged Electron
  - Claude Code version compatibility matrix with live current-version evidence
verification:
  targeted_tests: 5 files / 103 tests passed once; a second grouped rerun had one unrelated spec-22 recording list race that passed on isolated rerun.
  isolated_flaky_rerun: R8RuntimeService spec-22 recording manifest test passed when rerun by testNamePattern.
  typecheck: passed
  lint_no_emoji: passed; No emoji found in 574 files.
  zod_sot: passed
  gitnexus_impact:
  ClaudeParser: LOW risk; direct importer parsers/index.ts, indirect ParserRegistry and CLIOutputParser.
  R8RuntimeService: LOW risk; direct importers r8RuntimeHandlers.ts and ipc/index.ts.
  setupR8RuntimeHandlers: LOW risk; no upstream impacts reported.
```

## 16. Implementation Evidence - 2026-05-15 Result Error Notification Slice

```yaml
status: partial_verified_result_error_notification
implemented_now:
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.ts
  - devhub/src/main/services/cli-parser/parsers/ClaudeParser.test.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
verified_gwt_subset:
  result_error_payload: Claude result events now carry payload.rawType='result' and payload.isError=true when is_error=true.
  error_notification: R8RuntimeService emits a real unified notification with level=ERROR, source=ai-task, instanceId, duration, cost, and token summary for Claude result.is_error=true.
  no_fake_error: malformed JSON and schema-incomplete Claude stream events remain parser diagnostics and are not treated as Claude result notifications.
not_claimed_done:
  - automatic restart of a live Claude process with --output-format=stream-json
  - first-run user authorization popup for automatic restart
  - Playwright E2E against packaged Electron
  - Claude Code version compatibility matrix with live current-version evidence
verification:
  targeted_tests: pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/R8RuntimeService.test.ts -t "Claude|result.is_error" --maxWorkers=1
  result: 2 files passed, 7 tests passed, 96 skipped by filter
  gitnexus_impact:
  ClaudeParser: LOW risk; direct importer parsers/index.ts and test, indirect ParserRegistry and CLIOutputParser.
  R8RuntimeService: LOW risk; direct importers r8RuntimeHandlers.ts, ipc/index.ts, and R8RuntimeService.test.ts.
  NotificationService: MEDIUM risk; touched only through existing unified notification emit path, no notification service class edits.
```

## 17. Implementation Evidence - 2026-05-16 Claude SHIM Pre-Spawn Injection Slice

```yaml
status: partial_verified_shim_pre_spawn_injection
implemented_now:
  - devhub/shim/codex/codex-shim.cjs
  - devhub/src/main/services/shim/ShimRegistry.ts
  - devhub/src/main/services/shim/ShimRegistry.test.ts
  - devhub/docs/r8/claude-stream-json.md
verified_gwt_subset:
  generated_node_fallback: computes childArgs before spawn and passes normalized args into the real child process.
  packaged_source: uses the same Claude normalization in the shared CJS shim source used for packaged binaries.
  print_mode_default: claude -p/--print without output-format receives --output-format stream-json and --include-partial-messages before first spawn.
  existing_stream_json: explicit --output-format=stream-json is preserved and receives --include-partial-messages when missing.
  explicit_non_stream: explicit --output-format json is preserved and does not receive --include-partial-messages.
  non_print_mode: invocations without -p/--print are not modified.
  local_claude_version: this machine resolves claude to /c/Users/HP/AppData/Roaming/npm/claude and reports 2.1.111 (Claude Code); help output advertises --output-format stream-json, --include-partial-messages, and -p/--print.
  compatibility_matrix: docs/r8/claude-stream-json.md now records npm registry evidence for absent 0.1.x and 0.3.x lines, representative 0.2.x/1.0.x/current metadata, a 0.2.9 help probe without stream-json flags, local 2.1.111 support, and current dist-tags without claiming unexecuted latest support.
  packaged_e2e: Playwright Electron grep R8.C spec-03 feeds schema-valid Claude system/assistant tool_use/result NDJSON through the real runtime parser hook, observes cli:event-stream plus ai:claude-stream-event through preload, and verifies ai:claude-cost-summary.
not_claimed_done:
  - post-output live restart fallback after detecting unstructured Claude output
  - first-run user authorization popup for the future restart fallback
  - old-version fallback for releases that do not accept --output-format stream-json
verification:
  shim_registry: pnpm -C devhub test --run src/main/services/shim/ShimRegistry.test.ts --maxWorkers=1
  shim_registry_result: 1 file passed, 7 tests passed
  packaged_codex_guard: pnpm -C devhub shim:verify:codex
  packaged_codex_guard_result: Windows x64 executable exited 0, frameCount 3, stdoutPreserved true, stderrPreserved true
  packaged_e2e: pnpm -C devhub test:e2e --grep "R8.C spec-03" --reporter=line
  packaged_e2e_result: 1 passed
  local_claude_version: claude --version
  local_claude_help: claude --help
  npm_registry_versions: npm view @anthropic-ai/claude-code version versions --json
  npm_registry_dist_tags: npm view @anthropic-ai/claude-code dist-tags version --json
  representative_metadata: npm view @anthropic-ai/claude-code@0.2.9/@0.2.126/@1.0.0/@2.1.111/@2.1.143 version bin --json
  oldest_help_probe: npx --yes --package @anthropic-ai/claude-code@0.2.9 claude --help
  public_docs_corrob: grok_search found https://code.claude.com/docs/en/cli-reference as current public CLI reference for stream-json flags
```

## 18. Implementation Evidence - 2026-05-17 Post-Output Restart Authorization Closure

```yaml
status: verified_post_output_restart_authorization
implemented_now:
  - devhub/src/shared/schemas/claude-stream.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
  - devhub/src/main/services/shim/ShimRegistry.ts
  - devhub/src/main/services/shim/ShimRegistry.test.ts
  - devhub/shim/codex/codex-shim.cjs
verified_gwt_subset:
  fallback_frame: generated and packaged Claude shim paths attach argv, restartArgs, cwd, fallbackReason, and requiresUserConfirmation when stdout proves the child still is not stream-json.
  authorization_boundary: R8RuntimeService creates a persisted pending-confirmation restart request and unified WARN notification; no child process is spawned before the notification action or explicit confirm call.
  live_restart: confirmation runs a real local child process with forced --output-format stream-json and --include-partial-messages args, records pid/running/exited state, and feeds stdout/stderr back through the Claude NDJSON parser.
  no_mock_boundary: tests use process.execPath as the local wrapped child and verify actual child argv/stdout behavior; they do not call the Claude API and do not fabricate parser success.
  persistence_hardening: restart regression test uses a unique instanceId so old persisted cliEvents from previous local runs cannot satisfy the confirmation proof.
remaining_boundary:
  - Old Claude Code versions whose executable rejects --output-format stream-json remain unsupported; DevHub does not pretend those versions can produce structured output.
verification:
  lint_touched_files: pnpm -C devhub exec eslint src/shared/schemas/claude-stream.ts src/shared/schemas/r8-runtime.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/services/shim/ShimRegistry.ts src/main/services/shim/ShimRegistry.test.ts shim/codex/codex-shim.cjs
  typecheck: pnpm -C devhub exec tsc --noEmit --pretty false
  focused_restart_test: pnpm -C devhub test --run src/main/services/R8RuntimeService.test.ts -t "requires operator confirmation before restarting Claude" --maxWorkers=1
  claude_group: pnpm -C devhub test --run src/main/services/cli-parser/parsers/ClaudeParser.test.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/R8RuntimeService.test.ts -t "Claude|stream-json|ShimRegistry" --maxWorkers=1
  schema_preload_regression: pnpm -C devhub test --run src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts --maxWorkers=1
  result:
  lint_touched_files: passed
  typecheck: passed
  focused_restart_test: 1 file passed, 1 selected test passed, 115 skipped
  claude_group: 3 files passed, 16 tests passed, 113 skipped
  schema_preload_regression: 2 files passed, 26 tests passed
```
