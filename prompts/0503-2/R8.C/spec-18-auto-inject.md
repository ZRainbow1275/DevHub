# R8.C spec-18 — 自动注入引擎（6 场景 + 4 注入模式）

> **batch**: R8.C  |  **priority_in_batch**: #18（CSV/Watchdog 闭环）  |  **flag**: `R8.C.inject.engine`
> **depends_on**: spec-15（task queue 触发）+ spec-16（watchdog restart 触发）+ spec-19（目标选择 + 安全策略）+ spec-31（IPC 限流）+ spec-33（Zod SoT）+ R8.A spec-10（audit log）
> **blocks**: spec-22（录像绑定 inject）+ spec-23（回放 inject）
> **decision_anchor**: V1-Q-7.G.1 全选 6 场景 / V1-Q-6.D.2 答 F+E（GUI SendInput+UIA / 终端 pty）+ 用户备注"市面 AI CLI 最佳实践" / V1-Q-7.G.4 答 B 升级到 D（含完整内容审计）/ V1-Q-18.A 失败矩阵
> **estimated_loc**: 1500
> **risk**: high

---

## 1. motivation

```yaml
user_quote_v1_q_7_g_1: "全选：CSV / Watchdog 重启 / 任务链 / 错误恢复 / schedule / 手动模板"
user_quote_v1_q_6_d_2: "F + E — GUI SendInput + UIA；终端 node-pty；剪贴板 + Ctrl+V 是市面最佳实践"
user_quote_v1_q_7_g_4: "B（前 200 字符审计）→ 升级 D（完整审计 + 自动分块注入）"
user_quote_v1_q_6_d_3: "B + C + D — 首次确认 + 白名单 + CSV 自动模式"
feedback_4: "注入永远精准到指定 alias 实例的输入框"

goals:
  - 6 注入场景：csv-task-driven / watchdog-restart-resume / task-chain-next / error-recovery / user-schedule / manual-template
  - 4 注入模式：sendinput / pty / uia / clipboard-paste
  - 模式选择：CLI（Codex/Claude/Gemini）默认 pty；GUI（Cursor/VS Code/Claude Code 桌面）默认 uia + clipboard-paste；fallback sendinput
  - 11 失败模式（V1-Q-18.A.1 全部识别 + 处理）
  - 注入前 dry-run：把目标窗口截屏 + 验证可写性 + 倒计时
  - 完整内容审计：本地 SQLite append-only，不限长度（不再像 V1-Q-7.G.4 限 200 字符）
  - SHIM 协同：若已安装 spec-02..04 SHIM，元命令走 SHIM 控制 channel；prompt 走 stdin
  - 编码：统一 UTF-16，对中文/Emoji/特殊字符做处理
  - 由 spec-19 把关安全策略（白名单 + 倒计时 + 严格模式 + 目标选择器）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/inject/InjectService.ts
  - devhub/src/main/services/inject/scenarios/CsvTaskDrivenScenario.ts
  - devhub/src/main/services/inject/scenarios/WatchdogRestartResumeScenario.ts
  - devhub/src/main/services/inject/scenarios/TaskChainNextScenario.ts
  - devhub/src/main/services/inject/scenarios/ErrorRecoveryScenario.ts
  - devhub/src/main/services/inject/scenarios/UserScheduleScenario.ts
  - devhub/src/main/services/inject/scenarios/ManualTemplateScenario.ts
  - devhub/src/main/services/inject/modes/SendInputMode.ts
  - devhub/src/main/services/inject/modes/PtyMode.ts  # 走 spec-02..04 SHIM 通道
  - devhub/src/main/services/inject/modes/UiaMode.ts
  - devhub/src/main/services/inject/modes/ClipboardPasteMode.ts
  - devhub/src/main/services/inject/InjectModeSelector.ts
  - devhub/src/main/services/inject/InjectFailureClassifier.ts  # 11 失败模式诊断
  - devhub/src/main/services/inject/InjectChunker.ts  # 长内容分块
  - devhub/src/main/services/inject/InjectVerifier.ts  # 注入后验证 input 内容
  - devhub/src/main/services/inject/InjectAuditRepository.ts  # SQLite append-only
  - devhub/src/main/services/inject/InjectService.test.ts
  - devhub/src/shared/schemas/inject.ts
modified_files:
  - devhub/src/main/services/task-queue/TaskQueueService.ts  # task-start hook
  - devhub/src/main/services/watchdog/ActionExecutor.ts  # 调 inject:execute
  - devhub/src/main/ipc/injectHandlers.ts  # 新建
  - devhub/src/main/index.ts
glob_anchors:
  - devhub/src/main/services/window/windowHandlers.ts:463  # 现 SEND_KEYS 仅按键
  - devhub/src/main/services/cli-parser/strategies/ShimStrategy.ts  # spec-01 SHIM 元命令通道
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const InjectModeSchema = z.enum(['sendinput', 'pty', 'uia', 'clipboard-paste'])
export const InjectScenarioSchema = z.enum([
  'csv-task-driven',
  'watchdog-restart-resume',
  'task-chain-next',
  'error-recovery',
  'user-schedule',
  'manual-template',
])

export const InjectFailureKindSchema = z.enum([
  'window-not-found', 'window-iconic', 'no-focus',
  'input-not-ready', 'user-stole-focus', 'ignored',
  'wrong-position', 'encoding-error', 'rate-limited',
  'tool-crashed', 'clipboard-conflict',
])

export const InjectActionSchema = z.object({
  id: z.string().uuid(),
  scenario: InjectScenarioSchema,
  target: z.object({
  selector: z.enum(['alias', 'ready-pool', 'csv-row-alias', 'pid', 'window-handle']),
  aliasOrId: z.string(),
  pid: z.number().int().positive().optional(),
  hwnd: z.number().int().optional(),
  }),
  text: z.string(),
  textHash: z.string().regex(/^[a-f0-9]{64}$/),  // sha256(text)
  textLength: z.number().int(),
  isMetaCommand: z.boolean().default(false),  // /devhub:xxx 元命令
  mode: InjectModeSchema,
  modeFallback: z.array(InjectModeSchema).default([]),  // 失败时降级序列
  countdownMs: z.number().int().min(0).max(30000).default(3000),  // V1-Q-7.G.3
  strictModeRequiresExplicitConfirm: z.boolean().default(false),
  confirmedBy: z.enum(['user-explicit', 'auto-policy', 'whitelist', 'csv-mode']).nullable(),
  taskId: z.string().nullable(),
  sessionId: z.string().uuid().nullable(),
  recordingId: z.string().nullable(),
})
export type InjectAction = z.infer<typeof InjectActionSchema>

export const InjectResultSchema = z.object({
  actionId: z.string().uuid(),
  status: z.enum(['success', 'failed', 'cancelled', 'timeout', 'partial']),
  failureKind: InjectFailureKindSchema.nullable(),
  errorMessage: z.string().nullable(),
  modeUsed: InjectModeSchema,
  attemptCount: z.number().int(),
  durationMs: z.number().int(),
  injectedLength: z.number().int(),
  verifiedContentMatches: z.boolean().nullable(),  // input 验证后是否一致
  screenshotPathBefore: z.string().nullable(),
  screenshotPathAfter: z.string().nullable(),
})

export interface IInjectService {
  execute(action: Omit<InjectAction, 'id' | 'textHash' | 'textLength'>): Promise<InjectResult>
  dryRun(action: Omit<InjectAction, 'id' | 'textHash' | 'textLength'>): Promise<{
  targetExists: boolean
  suggestedMode: z.infer<typeof InjectModeSchema>
  suggestedFallback: z.infer<typeof InjectModeSchema>[]
  estimatedDurationMs: number
  }>
  cancel(actionId: string): Promise<boolean>
  getHistory(filter: { sessionId?: string, taskId?: string, sinceTs?: number }): Promise<InjectAction[]>
}
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  inject:execute:
  rate_limit: medium_query
  req: InjectAction (omit id/hash/length)
  resp: InjectResult
  inject:dry-run:
  rate_limit: medium_query
  req: InjectAction (omit id/hash/length)
  resp: { targetExists, suggestedMode, suggestedFallback, estimatedDurationMs }
  inject:cancel:
  rate_limit: low_freq_op
  req: { actionId: string }
  resp: { success: boolean }
  inject:history:
  rate_limit: medium_query
  req: { sessionId?: string, taskId?: string, sinceTs?: number }
  resp: InjectAction[]
  inject:stream:
  direction: main->renderer
  streaming: true
  payload: { actionId, status, progress, failureKind?, modeUsed, ts }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 目标 alias/pid/hwnd 不存在 | E_NOT_FOUND |
| 白名单拒绝（spec-19） | E_INJECT_BLOCKED |
| 倒计时被用户取消 | E_USER_CANCELLED |
| 注入超时（mode 全 fallback 用尽） | E_TIMEOUT |
| 严格模式未确认 | E_PERMISSION_DENIED |
| 文本长度超 OS API 上限（SendInput 16KB） | E_VALIDATION（自动分块） |
| 编码失败（非 UTF-16） | E_VALIDATION |
| 窗口最小化恢复失败 | E_RUNTIME |
| 窗口 IsHungAppWindow=true | E_RUNTIME |
| pty 无 SHIM 通道 | E_SHIM_NOT_INSTALLED |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (csv-task-driven 路径):
  given: spec-15 task-queue task-start，row.alias='claude-devhub'，spec-19 白名单已含
  when: InjectService.execute({scenario:'csv-task-driven', target:{selector:'alias', aliasOrId:'claude-devhub'}, text: row.prompt, mode:'pty'})
  then:
  - InjectResult.status === 'success'
  - audit log 记录完整 text（不截断）
  - spec-22 录像同时启动并绑定 actionId

GWT-2 (watchdog-restart-resume):
  given: spec-16 InnerWatchdog 触发 restart，原 prompt 缓存
  when: action.scenario='watchdog-restart-resume'，重启后实例 ready
  then:
  - 自动注入原 prompt + "[continue]" 上下文恢复指令
  - mode 优先 SHIM pty；不可用 fallback uia

GWT-3 (mode fallback 链):
  given: action.mode='uia', modeFallback=['clipboard-paste', 'sendinput']
  when: uia 失败（input 元素未找到）
  then:
  - 自动切 clipboard-paste 重试
  - 仍失败 → sendinput
  - 全失败 → InjectFailureKind='input-not-ready'

GWT-4 (倒计时取消):
  given: action.countdownMs=3000
  when: 用户在倒计时中按 ESC
  then:
  - InjectResult.status='cancelled'
  - 不实际注入
  - audit log 记录 cancelled

GWT-5 (长内容自动分块):
  given: text.length === 50000（超 SendInput 单次 16KB 上限）
  when: mode='sendinput'
  then:
  - InjectChunker 分 4 块
  - 块间 200ms 间隔
  - 完成后 InjectVerifier 验证总长度

GWT-6 (验证内容一致):
  given: 注入后 InjectVerifier 通过 UIA 读取 input 内容
  when: 内容与 text 不完全一致（如丢字符）
  then:
  - InjectResult.verifiedContentMatches=false
  - InjectResult.status='partial'
  - 通知用户

GWT-7 (元命令走 SHIM):
  given: text='/devhub:reset-context', isMetaCommand=true
  when: SHIM 已安装
  then:
  - 不通过 stdin / 键盘
  - 走 SHIM control channel（spec-01..04）
  - audit log 记录 channel='shim-control'

GWT-8 (用户夺焦立即中止):
  given: 注入中
  when: GetForegroundWindow 变化 != target.hwnd
  then:
  - 立即停止注入
  - InjectFailureKind='user-stole-focus'
  - status='cancelled'
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-18-auto-inject.spec.ts
test('GWT-1 csv-task-driven inject claude alias', async ({ page, electronApp }) => {
  await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.handle('test:start-claude-stub', () => ({ alias: 'claude-devhub', pid: 1234, hwnd: 0xDEAD }))
  })
  await page.evaluate(() => window.electronAPI.test.startClaudeStub())
  const res = await page.evaluate(async () => {
  return await window.electronAPI.inject.execute({
  scenario: 'csv-task-driven',
  target: { selector: 'alias', aliasOrId: 'claude-devhub' },
  text: 'Hello world',
  mode: 'pty',
  countdownMs: 0,
  confirmedBy: 'csv-mode',
  })
  })
  expect(res.status).toBe('success')
  expect(res.modeUsed).toBe('pty')
})

test('GWT-3 mode fallback chain', async ({ page }) => {
  const res = await page.evaluate(async () => {
  return await window.electronAPI.inject.execute({
  scenario: 'manual-template',
  target: { selector: 'alias', aliasOrId: 'cursor-test' },
  text: 'test',
  mode: 'uia',
  modeFallback: ['clipboard-paste', 'sendinput'],
  countdownMs: 0,
  confirmedBy: 'user-explicit',
  })
  })
  expect(['success', 'partial']).toContain(res.status)
  expect(['uia', 'clipboard-paste', 'sendinput']).toContain(res.modeUsed)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'node-key-sender@1.0':  SendInput baseline（仅按键）
  - 'robotjs@0.6':  跨平台 send keys + clipboard
  - 'win-uia@x':  Windows UIAutomation 封装
  - 'node-pty@10.x':  pty 通道（spec-01..04 SHIM 复用）
  - 'clipboardy@4.x':  clipboard read/write
  - 'systeminformation@5.x':  pid → window 列表
  - 'win-window-info@x':  GetForegroundWindow / IsHungAppWindow / IsIconic
  - 'better-sqlite3@11.x':  audit append-only
  - 'screenshot-desktop@1.x':  注入前后截屏（dry-run + 失败诊断）
inspirations:
  - "Anthropic Claude Code 桌面端 inject mode（剪贴板 + Ctrl+V 路径最稳）"
  - "AutoHotkey 控件文本写入 ControlSetText"
  - "Selenium ActionChains.send_keys"
  - "Microsoft FlauUI / FlauI"
mode_selection_table:
  codex_terminal:  pty (via SHIM) → clipboard-paste → sendinput
  claude_code_gui:  uia → clipboard-paste → sendinput
  claude_cli:  pty (via SHIM) → clipboard-paste
  gemini_cli:  pty (via SHIM) → clipboard-paste → sendinput
  cursor_gui:  clipboard-paste → uia → sendinput
  copilot_gui:  clipboard-paste → uia
encoding:
  - input UTF-8 → convert to UTF-16 LE for Windows API
  - normalize NFC for emoji + 中文
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~900
modified_loc: ~120
test_loc: ~480
total: ~1500
risk_areas:
  - 不同 Windows 版本 UIA 行为差异
  - 剪贴板与用户同时复制的冲突（mutex + restore 原内容）
  - 长内容分块时输入框边界处理（自动换行被吞）
  - 用户夺焦的检测窗口（< 50ms）
  - audit 完整 text 隐私（用户后悔 → 提供清除接口）
```

---

## 10. implement_checklist

- [x] 6 scenario 子类继承 ScenarioBase，提供 prepare(opts)/buildAction()/onSuccess()/onFailure() 钩子
- [x] 4 mode 子类实现 IInjectMode：sendinput / pty / uia / clipboard-paste
- [x] InjectModeSelector 按 mode_selection_table + 用户配置选最优
- [x] 注入前序：检查 target 存在 → 检查白名单（spec-19）→ 倒计时 → 截屏 before
- [x] 注入后序：验证 input 内容（UIA 读 / pty echo 比对）→ 截屏 after → 写 audit
- [x] 11 failure kind 分类器：每种独立诊断 + 推荐处理
- [x] InjectChunker：≤ 8KB/块 + 200ms 间隔 + 块间检查焦点
- [x] 用户夺焦立即中止：每 50ms ping GetForegroundWindow
- [x] clipboard-paste：保存原剪贴板 → 写入 → Ctrl+V → 恢复原内容
- [x] 元命令通过 SHIM control channel（spec-02..04）走带外通信
- [x] feature flag `R8.C.inject.engine` 默认 ON；`R8.C.inject.engine.audit-full-content` 默认 ON（可关）
- [x] audit DB 路径 `%APPDATA%/devhub/inject-audit.sqlite`，sha256(text) 索引
- [x] vitest fixture：覆盖每种 failure kind / mode fallback / 用户夺焦
- [x] 限流：inject:execute 走 medium_query 桶
- [x] dry-run 必须支持完全沙箱（不实际写入），用于 spec-19 预演

---

## 11. dependencies

```yaml
upstream:
  - spec-15: task-queue task-start 触发 csv-task-driven
  - spec-16: watchdog action 触发 restart-resume / fallback
  - spec-19: 目标选择 + 白名单 + 严格模式
  - spec-31: IPC 限流
  - spec-33: Zod SoT
  - R8.A spec-10: audit log 写入
  - R8.A spec-11: 危险操作权限提示
downstream:
  - spec-22: 录像绑定 actionId
  - spec-23: 回放 inject 时间线
  - spec-29: 反馈循环消费 failureKind 分类
  - spec-30: 通知 inject 失败
```

---

## 12. fallback_strategy

```yaml
on_uia_unavailable:
  - 移除 mode list 中的 uia
  - 自动选 clipboard-paste 或 sendinput
on_clipboard_user_conflict:
  - 检测到剪贴板内容在 inject 期间被用户修改
  - InjectFailureKind='clipboard-conflict' + 不重试 + 通知
on_pty_no_shim:
  - 普通 prompt 可退化到 clipboard-paste / sendinput
  - 元命令必须失败并提示 SHIM channel，不允许退化到 UI 注入
  - 提示用户安装 SHIM（spec-02..04）
on_long_text_chunk_fail:
  - 切 clipboard-paste 一次性粘贴
on_user_steal_focus:
  - 立即 cancel 当前 action
  - 不重试（避免与用户操作冲突）
flag_off_behavior:
  - R8.C.inject.engine=OFF → 退回 R7 仅 SEND_KEYS 按键模式（用户手动）
```

---

## 13. performance_budget

```yaml
inject_csv_to_terminal_p95_ms: 800
inject_csv_to_terminal_fatal_ms: 2500
inject_chunk_size_bytes: 8192
inject_chunk_interval_ms: 200
focus_steal_check_interval_ms: 50
mode_fallback_max_retries: 3
audit_write_p99_ms: 5
clipboard_save_restore_p99_ms: 50
uia_text_set_p95_ms: 200
sendinput_per_char_us: 100
verifier_read_p95_ms: 80
ipc_channel: inject:execute → spec-31 medium_query 60 RPM
inject_concurrency_max: 4  # 同一 DevHub 实例同时 inject 上限
```

## 14. implementation_checkpoint_2026_05_04_inject_contract_slice

```yaml
status: inject_contract_engine_verified
implemented:
  - Added shared Zod source-of-truth contracts in src/shared/schemas/inject.ts for inject mode, scenario, failure kind, target, normalized action, dry-run result, execution result, and full-content audit record.
  - Added InjectService with real normalization, sha256 textHash generation, NFC text normalization, mode selection, fallback traversal, full-content audit persistence, and explicit no-fake execution semantics.
  - Added InjectModeSelector with CLI/GUI/meta-command mode preferences: CLI aliases can prefer pty with clipboard/sendinput fallback; GUI aliases can prefer clipboard/uia/sendinput; unknown aliases do not invent fallback when sendinput was explicitly requested.
  - Added InjectChunker with UTF-8 byte-bounded chunks at 8192 bytes by default, preserving multi-byte characters without splitting text content.
  - Added InjectFailureClassifier for spec-18 failure families, including permission, target-not-found, shim-not-installed, clipboard-conflict, encoding-error, tool-crashed, input-not-ready, native-disabled, and runtime-error.
  - Added InjectAuditRepository backed by the existing runtime store. It records full text, textHash, scenario, targetAlias, requested/used mode, status, failureKind, and confirmedBy. SQLite remains a future adapter boundary and is not falsely claimed.
  - R8RuntimeService now delegates dryRunInject and executeInject to InjectService while preserving existing IPC/preload compatibility. Execution requires confirmedBy, target whitelist resolution, and a real native typer success; otherwise it returns a real failed result such as E_NOT_FOUND, E_SHIM_NOT_INSTALLED, or NUT_JS_DISABLED_BY_FLAG.
verified_by:
  - src/main/services/inject/InjectService.test.ts covers missing-target dry-run audit, pty/clipboard fallback to real sendinput, all-mode failure without fake success, and UTF-8 chunking.
  - src/main/services/R8RuntimeService.test.ts covers integrated dry-run/execute behavior through whitelist resolution and native-disabled failure.
  - src/shared/schemas/r8-runtime.test.ts covers backward-compatible orchestration schema parsing after the expanded inject result contract.
  - pnpm test --run src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 passed: 3 files / 44 tests.
  - pnpm typecheck passed.
  - pnpm lint passed, including no-emoji over 314 files.
known_boundaries:
  - Real UIA adapter, clipboard ownership/restore integration, pty SHIM control channel execution, screenshots before/after, post-inject verifier reads, SQLite audit adapter, focus-steal polling, task-queue/watchdog triggers, and spec-22 recording binding remain future work and are not claimed complete in this slice.
  - The current sendinput execution path is real only when @nut-tree-fork/nut-js is installed and enabled by feature flag; otherwise execution fails truthfully rather than returning success.
```

## 15. implementation_status_2026_05_11_inject_selector_sandbox_sync

```yaml
status: inject_selector_sandbox_partial_verified
implemented:
  - Strengthened InjectModeSelector coverage for CLI aliases, GUI aliases, meta-command routing, and explicit user fallback order.
  - Fixed GUI alias fallback selection so a default sendinput request becomes clipboard-paste with uia and sendinput fallback, matching the mode-selection table rather than dropping the final sendinput fallback.
  - Strengthened feature-flag coverage for R8.C.inject.engine and R8.C.inject.engine.audit-full-content default ON, while keeping strict target mode default OFF.
  - Verified dry-run remains a full sandbox: it resolves targets, chunks text, writes local audit history, and never calls the native typer.
  - Tightened sendinput execution semantics so a native typer success response that reports fewer written characters than requested is downgraded to status=partial with E_PARTIAL_INJECT instead of being counted as a successful injection.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts src/main/services/inject/InjectTargetResolver.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 passed: 3 files / 19 tests.
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts src/main/services/inject/InjectTargetResolver.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "inject|Inject|default disabled states|feature flag|preload|IPC|schema" passed: 7 files / 37 tests, 98 skipped by filter.
known_boundaries:
  - Scenario subclasses, real UIA/clipboard/pty adapters, screenshot capture, post-inject verifier reads, SQLite audit storage, focus-steal polling, SHIM control-channel execution, task-queue/watchdog triggers, full failure-kind recommendation matrix, and rate-limit class drift remain open.
```

## 16. implementation_status_2026_05_18_inject_countdown_stream

```yaml
status: inject_countdown_stream_partial_verified
implemented:
  - Added shared Zod contracts for InjectCountdownPhase and InjectCountdownStreamPayload, and registered them in the R8 runtime schema registry.
  - R8RuntimeService now assigns a stable actionId before execution, resolves the real target/whitelist/strict-mode countdown gate, and emits inject:countdown-stream scheduled/tick/completed events before calling the real InjectService execution path.
  - Countdown ticks are emitted at 100ms cadence or faster final completion boundary, with totalMs/remainingMs/elapsedMs/actionId/scenario/targetAlias/canCancel validated through the shared schema before renderer delivery.
  - Existing inject:countdown-cancel now cancels an active pre-execution countdown, returns a real status=cancelled InjectResult with injectedLength=0, and does not call native typing after cancellation.
  - Added preload cleanup bridge window.devhub.r8.inject.onCountdownStream(callback), renderer global typing, and legacy IPC contract whitelist entry for inject:countdown-stream.
verified_by:
  - pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "countdown|R8 IPC|injection dry-run" passed: 1 runtime file / 3 tests, schema file skipped by filter.
  - pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "R8.B and R8.C IPC|orchestration result" passed: 1 file / 2 tests.
  - pnpm -C devhub typecheck passed.
  - pnpm -C devhub exec eslint src/shared/schemas/inject.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/preload/index.ts src/renderer/types/global.d.ts --max-warnings=0 passed.
  - pnpm -C devhub check:zod-sot passed.
  - pnpm -C devhub check:no-emoji passed.
known_boundaries:
  - This closes only the countdown stream/controller bridge boundary. InjectCountdownModal, whitelist drawer, first-time modal, real UIA/clipboard/pty adapters, screenshots, verifier reads, SQLite audit storage, focus-steal polling, and task-queue/watchdog trigger policies remain open.
```

## 17. implementation_status_2026_05_18_failure_classifier_matrix

```yaml
status: inject_failure_classifier_matrix_verified
implemented:
  - InjectFailureClassifier now exposes diagnose(error) with failureKind, recommendation, and retryable metadata while preserving the existing classify(error) API used by InjectService.
  - The classifier covers every shared InjectFailureKind value independently: window-not-found, window-iconic, no-focus, input-not-ready, user-stole-focus, ignored, wrong-position, encoding-error, rate-limited, tool-crashed, clipboard-conflict, permission, target-not-found, native-disabled, shim-not-installed, and runtime-error.
  - Each failure kind maps to an explicit operator recommendation rather than a silent generic fallback, while unknown errors still degrade truthfully to runtime-error.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "failure kind|fails truthfully|partial" passed: 1 file / 3 tests.
known_boundaries:
  - The classifier is verified as a diagnosis/recommendation matrix. UI surfacing of recommendations, focus-steal polling, real adapter-specific telemetry, and notification integration remain downstream boundaries.
```

## 18. implementation_status_2026_05_18_chunked_sendinput_execution

```yaml
status: inject_chunked_sendinput_verified
implemented:
  - InjectService now routes sendinput execution through InjectChunker output instead of sending the whole prompt as one native typing request.
  - Default inter-chunk delay is 200ms, preserving the spec budget while keeping pty/uia/clipboard unavailable boundaries truthful.
  - A focusCheck hook is evaluated before each chunk; loss of focus between chunks returns user-stole-focus and does not continue native typing.
  - Partial native writes are still downgraded to status=partial with E_PARTIAL_INJECT, and successful multi-chunk writes preserve the real total injectedLength and chunkCount.
  - InjectService Vitest fixtures now cover mode fallback order, every failure-kind diagnosis, partial write handling, and user focus loss between chunks without treating fixtures as runtime success evidence.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 passed: 1 file / 9 tests, including bounded UTF-8 chunks, 200ms interval, and focus-change stop coverage.
known_boundaries:
  - This implements the generic service-level chunk interval and focus hook. Real 50ms OS foreground polling, UIA/clipboard/pty adapters, screenshots, verifier reads, and renderer failure recommendation surfacing remain open.
```

## 19. implementation_status_2026_05_18_inject_execute_rate_limit

```yaml
status: inject_execute_rate_limit_verified
implemented:
  - Changed the shared R8 IPC registry for inject:execute from low_freq_op to medium_query, matching the spec-18 60 RPM bucket.
  - Changed the concrete main-process inject:execute handler to use the explicit medium_query rate-limit class instead of the generic low-frequency action bucket.
  - Added schema/runtime assertions so registry and rate-limit registration drift is caught by tests.
verified_by:
  - pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "R8.B and R8.C IPC|spec-31 channel" passed after this change.
known_boundaries:
  - This closes only the inject:execute bucket classification. Other inject execution boundaries remain governed by their own checklist items.
```

## 20. implementation_status_2026_05_18_sqlite_audit_adapter

```yaml
status: inject_sqlite_audit_adapter_verified
implemented:
  - InjectAuditRepository now writes append-only full-content audit records to a real better-sqlite3 database when auditDbPath is configured, while keeping the existing runtime store as a bounded fallback.
  - The SQLite table stores full text, sha256(text), text length, scenario, target alias, requested/used mode, status, failure kind, confirmer, createdAt, and the canonical payload_json record.
  - The SQLite schema creates indexes for text_hash, created_at, and action_id so audit lookups can use sha256(text) without truncating or hashing away the full local text record.
  - R8RuntimeService configures InjectService with join(app.getPath('userData'), 'inject-audit.sqlite'), matching the `%APPDATA%/devhub/inject-audit.sqlite` production path convention for the packaged Electron app.
  - SQLite list reads validate payload_json through the shared injectAuditRecordSchema and skip malformed persisted rows defensively instead of crashing unrelated inject audit reads.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "SQLite audit|audit" passed: 1 file / 2 tests, proving real SQLite table/index/full-text/hash lookup and malformed-row skip.
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "SQLite audit|injection dry-run" passed: 2 files / 2 tests, proving R8RuntimeService creates and queries the real userData inject-audit.sqlite path.
  - pnpm -C devhub typecheck passed.
known_boundaries:
  - This closes only the SQLite audit DB path and sha256(text) index boundary. Real UIA/clipboard/pty adapters, screenshot capture, post-inject verifier reads, OS-level 50ms focus polling, SHIM control-channel execution, and task-queue/watchdog triggers remain open.
```

## 21. implementation_status_2026_05_18_scenario_subclass_tree

```yaml
status: inject_scenario_subclass_tree_verified
implemented:
  - Added ScenarioBase with real prepare(opts), buildAction(), onSuccess(), and onFailure() hooks that validate text/target requirements and return schema-validated inject action inputs.
  - Added six concrete scenario subclasses: CsvTaskDrivenScenario, WatchdogRestartResumeScenario, TaskChainNextScenario, ErrorRecoveryScenario, UserScheduleScenario, and ManualTemplateScenario.
  - Added InjectScenarioRegistry so the scenario tree is discoverable and executable through InjectService.buildScenarioAction rather than existing as orphan files.
  - Scenario defaults encode the documented routing intent: csv-task-driven uses pty with clipboard-paste/sendinput fallback and csv-mode confirmation; watchdog restart-resume appends a [continue] resume marker and falls back through uia/sendinput; manual-template remains explicit sendinput/user-explicit.
  - Scenario hook results preserve scenario, actionId, status, failureKind, and handledAt so downstream audit/notification integrations can consume a typed outcome without inventing a parallel mapping.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "scenario|SQLite audit" passed: 1 file / 2 tests, proving all six scenario subclasses build executable actions accepted by InjectService dry-run and hooks.
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 passed: 1 file / 11 tests.
  - pnpm -C devhub typecheck passed.
  - pnpm -C devhub exec eslint src/main/services/inject/InjectService.ts src/main/services/inject/InjectService.test.ts src/main/services/inject/scenarios/ScenarioBase.ts src/main/services/inject/scenarios/CsvTaskDrivenScenario.ts src/main/services/inject/scenarios/WatchdogRestartResumeScenario.ts src/main/services/inject/scenarios/TaskChainNextScenario.ts src/main/services/inject/scenarios/ErrorRecoveryScenario.ts src/main/services/inject/scenarios/UserScheduleScenario.ts src/main/services/inject/scenarios/ManualTemplateScenario.ts src/main/services/inject/scenarios/InjectScenarioRegistry.ts src/main/services/inject/scenarios/index.ts src/main/services/inject/index.ts --max-warnings=0 passed.
known_boundaries:
  - This closes only the scenario subclass and hook structure. Real UIA/clipboard/pty adapters, screenshot capture, post-inject verifier reads, OS-level 50ms focus polling, SHIM control-channel execution, and task-queue/watchdog triggers remain open.
```

## 22. implementation_status_2026_05_18_mode_subclass_registry

```yaml
status: inject_mode_subclass_registry_verified
implemented:
  - Added IInjectMode plus concrete SendInputMode, PtyMode, UiaMode, and ClipboardPasteMode classes.
  - Added InjectModeRegistry and exported it through the inject service barrel so mode handlers are discoverable and executable without hardcoded switch branches in InjectService.
  - InjectService now routes every selected/fallback mode through InjectModeRegistry.execute while preserving existing attempt counting, audit writes, partial-write downgrade, chunked sendinput, and focus-hook behavior.
  - SendInputMode delegates to the existing real chunked native typer pipeline; PtyMode, UiaMode, and ClipboardPasteMode return explicit unavailable-boundary errors instead of fake success.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "mode|fallback|partial|focus" passed: 1 file / 7 tests, proving all four concrete modes execute through the registry and unavailable adapters fail truthfully.
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 passed: 1 file / 12 tests.
  - pnpm -C devhub typecheck passed.
  - pnpm -C devhub exec eslint src/main/services/inject/InjectService.ts src/main/services/inject/InjectService.test.ts src/main/services/inject/modes/IInjectMode.ts src/main/services/inject/modes/SendInputMode.ts src/main/services/inject/modes/PtyMode.ts src/main/services/inject/modes/UiaMode.ts src/main/services/inject/modes/ClipboardPasteMode.ts src/main/services/inject/modes/InjectModeRegistry.ts src/main/services/inject/modes/index.ts src/main/services/inject/index.ts --max-warnings=0 passed.
known_boundaries:
  - This closes only the IInjectMode subclass/registry structure. Real UIA adapter behavior, clipboard ownership/restore, pty SHIM control-channel execution, screenshots, verifier reads, OS-level 50ms focus polling, and task-queue/watchdog triggers remain open.
```

## 23. implementation_status_2026_05_18_clipboard_paste_bridge

```yaml
status: inject_clipboard_paste_bridge_verified
implemented:
  - ClipboardPasteMode now saves the current clipboard text, writes the full inject action text, triggers a paste shortcut, and restores the original clipboard text before returning.
  - R8RuntimeService wires ClipboardPasteMode to Electron clipboard.readText/writeText and NutJsAdapter.pressPasteShortcut, so the production path uses the real local clipboard and a real Ctrl+V keyboard shortcut when nut-js is enabled.
  - NutJsAdapter now exposes pressPasteShortcut with the existing R8.A.libs.nut-js feature flag gate; when nut-js is disabled or unavailable the mode fails truthfully instead of reporting injected success.
  - Clipboard restore failure returns E_CLIPBOARD_RESTORE_FAILED and does not claim successful injection.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "clipboard|mode|fallback" passed: 1 file / 5 tests, including save/write/paste/restore ordering and no native typer fallback when clipboard-paste succeeds.
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 passed: 1 file / 13 tests.
  - pnpm -C devhub typecheck passed.
  - pnpm -C devhub exec eslint src/main/services/integrations/NutJsAdapter.ts src/main/services/integrations/index.ts src/main/services/R8RuntimeService.ts src/main/services/inject/InjectService.ts src/main/services/inject/InjectService.test.ts src/main/services/inject/modes/IInjectMode.ts src/main/services/inject/modes/ClipboardPasteMode.ts --max-warnings=0 passed.
known_boundaries:
  - This closes only clipboard-paste save/write/Ctrl+V/restore behavior. Real UIA adapter behavior, pty SHIM control-channel execution, screenshots, post-inject verifier reads, and task-queue/watchdog triggers remain open.
```

## 24. implementation_status_2026_05_18_foreground_focus_polling

```yaml
status: partial
closed_checklist:
  - 用户夺焦立即中止：每 50ms ping GetForegroundWindow
evidence:
  - `devhub/src/main/services/inject/FocusPollingGuard.ts` adds a real foreground-window polling session with a default 50ms interval, expected HWND/baseline HWND comparison, early wait cancellation, and truthful `E_USER_STOLE_FOCUS` / `E_NO_FOCUS` failure reasons.
  - `devhub/src/main/services/integrations/NodeWindowManagerAdapter.ts#getActiveWindow()` reuses the installed `node-window-manager@2.2.4` native `getActiveWindow()` path instead of adding a mock provider or a new dependency.
  - `devhub/src/main/services/R8RuntimeService.ts` wires `InjectService.foregroundWindowProvider` to the real Node window manager adapter and fixes the polling interval at 50ms for runtime injection.
  - `devhub/src/main/services/inject/InjectService.ts` starts a polling session per executable mode, compares resolved target HWND when available or the foreground baseline otherwise, aborts without falling through to other modes on focus loss, and checks focus before and after native chunk typing plus during chunk delays.
  - `devhub/src/main/services/inject/InjectService.test.ts` verifies that a foreground HWND change at 50ms aborts a two-chunk sendinput action with `failureKind=user-stole-focus` and prevents the second native typing call.
validation:
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "foreground window|focus ownership|bounded chunks"` passed on 2026-05-18.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
remaining_boundaries:
  - This closes the OS-level foreground polling checklist item. Real UIA adapter behavior, screenshots, post-inject verifier reads, and task-queue/watchdog triggers remain open.
```

## 25. implementation_status_2026_05_18_shim_control_channel

```yaml
status: partial
closed_checklist:
  - 元命令通过 SHIM control channel（spec-02..04）走带外通信
evidence:
  - `devhub/src/shared/schemas/r8-runtime.ts` adds a strict `ShimControlFrame` Zod contract for stdin control frames with requestId, text, appendNewline, and ts fields.
  - `devhub/src/main/services/shim/ShimRegistry.ts` keeps active shim sockets, writes JSON-line stdin control frames to connected generated or packaged shims, waits for a real `DEVHUB::MARKER::v=1::CONTROL=<requestId>` ACK frame, and fails truthfully with `E_SHIM_NOT_CONNECTED` or `E_SHIM_CONTROL_ACK_TIMEOUT` instead of local fake success.
  - `devhub/src/main/services/shim/ShimRegistry.ts#buildNodeShimScript` and `devhub/shim/codex/codex-shim.cjs` parse reverse socket control frames, write the payload into the real child process stdin, and emit success/error control markers over the existing SHIM frame channel.
  - `devhub/src/main/services/inject/modes/PtyMode.ts` sends `isMetaCommand=true` actions through `shimControlBridge` for codex/claude/gemini targets and leaves ordinary prompt pty behavior truthful when no installed SHIM channel is available.
  - `devhub/src/main/services/inject/InjectService.ts` passes the resolved target and SHIM bridge into mode execution and prevents meta-command failures from falling back to clipboard or sendinput UI injection.
  - `devhub/src/main/services/R8RuntimeService.ts` wires `InjectService.shimControlBridge` to the real `ShimRegistry.sendControl()` path.
  - `devhub/src/main/services/shim/ShimRegistry.test.ts` starts real generated and packaged shim processes, sends control frames through the socket, verifies child stdin echo output, and asserts the returned ACK frame.
  - `devhub/src/main/services/inject/InjectService.test.ts` verifies meta-command pty success through the SHIM bridge and failure without sendinput fallback when the control channel is unavailable.
validation:
  - `pnpm -C devhub exec vitest run src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "control|meta-command|pty"` passed on 2026-05-18.
  - `pnpm -C devhub exec vitest run src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.test.ts --maxWorkers=1` passed on 2026-05-18 with 26 tests.
remaining_boundaries:
  - This closes the SHIM control-channel meta-command checklist item. Real UIA adapter behavior, screenshots, post-inject verifier reads, and task-queue/watchdog triggers remain open.
```

## 26. implementation_status_2026_05_18_pre_inject_screenshot_sequence

```yaml
status: partial
closed_checklist:
  - 注入前序：检查 target 存在 → 检查白名单（spec-19）→ 倒计时 → 截屏 before
evidence:
  - `devhub/src/main/services/inject/InjectService.ts` now captures a before screenshot after target existence, ready-pool, whitelist, and strict-mode gates pass, and before any executable mode can type into a target.
  - `devhub/src/main/services/R8RuntimeService.ts` wires the screenshot bridge to the existing real `WindowManager.screenshotWindow(hwnd)` path when the shared runtime window manager is available.
  - `devhub/src/main/services/WindowManager.ts#screenshotWindow` already persists real PNG screenshots under app userData `window-screenshots` using the current window rectangle and Win32 screen capture path.
  - `devhub/src/main/services/inject/InjectService.ts` returns `screenshotPathBefore` on successful and partial inject results, and fails before native typing if a configured screenshot bridge reports `E_SCREENSHOT_BEFORE_FAILED`.
  - `devhub/src/main/services/inject/InjectService.ts` also captures an after screenshot after successful native writes; after-screenshot failure downgrades the result to `partial` with the real injectedLength rather than reporting complete success.
  - The screenshot bridge is no-op only in isolated service tests or runtimes without a shared WindowManager; the packaged app startup passes the scanner WindowManager through `SharedMonitorRuntime`.
validation:
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "screenshot|meta-command|fallback|foreground"` passed on 2026-05-18.
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1` passed on 2026-05-18 with 18 tests.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
remaining_boundaries:
  - This closes the pre-inject sequence checklist item and partially advances post-inject evidence with after screenshot capture. Post-inject content verification, real UIA adapter behavior, ordinary prompt pty behavior, and task-queue/watchdog trigger E2E remain open.
```

## 27. implementation_status_2026_05_18_post_inject_pty_echo_verification

```yaml
status: verified
closed_checklist:
  - 注入后序：验证 input 内容（UIA 读 / pty echo 比对）→ 截屏 after → 写 audit
evidence:
  - `devhub/src/main/services/shim/ShimRegistry.ts` extends `sendControl()` with optional `verifyEcho`, `echoText`, and bounded `echoTimeoutMs` post-write verification. ACK success still means the child stdin write completed, while `verifiedContentMatches=false` truthfully reports that no matching stdout/stderr echo was observed.
  - `devhub/src/main/services/shim/ShimRegistry.ts` now maintains pending echo verifiers per tool, ignores DevHub marker frames, and matches normalized stdout/stderr content against the injected text or its non-empty line fragments without treating the control ACK as content verification.
  - `devhub/src/main/services/inject/modes/PtyMode.ts` routes ordinary codex/claude/gemini prompt injection through SHIM stdin with `verifyEcho=true`; meta commands still use the same SHIM control channel with `verifyEcho=false` because control commands are not required to echo.
  - `devhub/src/main/services/inject/InjectService.ts` preserves the real injected character count, captures the after screenshot, and downgrades the result to `partial` with `verifiedContentMatches=false` when the pty echo proof is absent instead of reporting fake success.
  - `devhub/src/main/services/inject/InjectAuditRepository.ts` and `devhub/src/shared/schemas/inject.ts` add canonical audit payload fields for `verifiedContentMatches`, `verificationError`, and before/after screenshot paths, so success and partial outcomes are persisted with their post-inject proof state.
  - `devhub/src/main/services/R8RuntimeService.ts` passes echo verification options through the real `ShimRegistry.sendControl()` bridge and returns verification evidence to the inject mode result.
  - `devhub/src/main/services/shim/ShimRegistry.test.ts` starts real generated and packaged shim processes, sends stdin control frames into real child Node processes, verifies stdout echo matches the injected content, and separately verifies the no-echo path returns delivered-but-unverified rather than fake success.
  - `devhub/src/main/services/inject/InjectService.test.ts` covers ordinary pty prompt success with `verifiedContentMatches=true`, partial downgrade when SHIM echo verification fails, after-screenshot retention, and audit payload persistence for the verification state.
validation:
  - `pnpm -C devhub exec vitest run src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "control|ordinary pty|meta-command|screenshot|partial"` passed on 2026-05-18.
  - `pnpm -C devhub exec vitest run src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.test.ts --maxWorkers=1` passed on 2026-05-18 with 32 tests.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec eslint src/main/services/shim/ShimRegistry.ts src/main/services/shim/ShimRegistry.test.ts src/main/services/inject/InjectService.ts src/main/services/inject/InjectService.test.ts src/main/services/inject/InjectAuditRepository.ts src/main/services/inject/modes/IInjectMode.ts src/main/services/inject/modes/PtyMode.ts src/main/services/R8RuntimeService.ts src/shared/schemas/inject.ts` passed on 2026-05-18.
remaining_boundaries:
  - This closes the spec-18 post-inject checklist through the real pty echo comparison branch plus after screenshot and audit persistence. Real UIA readback behavior and task-queue/watchdog trigger E2E remain outside this checklist closure and stay tracked in their dependent rows.
```

## 28. implementation_status_2026_05_18_task_watchdog_trigger_closure

```yaml
status: trigger_integration_verified
implemented:
  - `R8RuntimeService.startReadyTasks()` now calls the inject engine for each real started CSV task whose row has `allow_inject=true`.
  - The task-start hook uses the existing `csv-row-alias` selector, target alias `${tool}-${row.id}`, scenario `csv-task-driven`, mode `pty`, fallback `clipboard-paste/sendinput`, and confirmer `task-queue-start`.
  - `StoreBackedTaskQueueService.attachInjectAction()` persists the real inject action id back onto the `TaskRun`, so downstream flow/audit surfaces can correlate the task-start trigger with the inject audit row.
  - The hook does not fabricate success. If the real adapter stack is unavailable, the inject engine records the truthful blocked/failed result and still links the real action id to the task run.
  - Existing watchdog restart action integration was revalidated through `WatchdogActionExecutor`: a real watchdog `action-taken` event completes the running task into retry state, calls `executeInject()` with scenario `watchdog-restart-resume`, records the inject action id, and emits the real watchdog notification.
  - Explicit `targetAlias` now takes precedence over selector payload alias in `InjectService` and `R8RuntimeService.injectActionTargetAlias()`, preventing `csv-row-alias` row ids from being misreported as the destination alias.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "task-start inject|allow_inject"` passed on 2026-05-18 with 1 file / 1 test.
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "executes watchdog restart actions through task queue, inject, and notifications"` passed on 2026-05-18 with 1 file / 1 test.
remaining_boundaries:
  - Native adapter success still depends on the real target adapter being available; unavailable adapters continue to fail truthfully rather than being simulated.
```

## 29. implementation_status_2026_05_18_uia_readback_closure

```yaml
status: spec18_verified
implemented:
  - `UiaMode` now executes a real Windows UIAutomation path instead of returning a placeholder unavailable error.
  - The adapter requires a resolved target HWND, loads `UIAutomationClient` / `UIAutomationTypes`, locates an editable descendant through the raw UIA tree, and writes through `ValuePattern.SetValue()` when the target supports it.
  - For Win32 edit controls that are discoverable as native child windows but do not expose `ValuePattern` on this machine, the adapter falls back to real `user32.dll` `WM_SETTEXT` / `WM_GETTEXT` against the discovered `EDIT` child handle. The fallback still performs a real write and readback; it does not synthesize success.
  - The returned inject mode data reports real character count and `verifiedContentMatches` from the readback value.
  - Non-Windows runtimes and targets without an HWND fail explicitly with `E_RUNTIME` / `E_VALIDATION` rather than pretending UIA is available.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "UIA"` passed on 2026-05-18 with a real WinForms TextBox target and real UIA/Win32 readback.
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts --maxWorkers=1 -t "mode classes|UIA|fails truthfully"` passed on 2026-05-18 with 3 tests.
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "UIA|mode classes|task-start inject|executes watchdog restart actions through task queue, inject, and notifications|injection dry-run"` passed on 2026-05-18 with 2 files / 4 tests.
  - `pnpm -C devhub exec eslint src/main/services/inject/modes/UiaMode.ts src/main/services/inject/InjectService.ts src/main/services/inject/InjectService.test.ts src/main/services/task-queue/TaskQueueService.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts` passed on 2026-05-18.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub build` passed on 2026-05-18 with only the known Monaco dynamic/static import warning.
  - `pnpm -C devhub check:zod-sot` and `pnpm -C devhub check:no-emoji` passed on 2026-05-18.
remaining_boundaries:
  - No spec-18 checklist or non-checkbox implementation boundary remains open. Native success remains environment-dependent and is reported truthfully by the real adapter stack.
```
