# R8.C spec-19 — 注入目标选择 + 安全策略（白名单 + 倒计时 + 严格模式）

> **batch**: R8.C  |  **priority_in_batch**: #19（inject 安全闸门）  |  **flag**: `R8.C.inject.targets`
> **depends_on**: spec-18（注入引擎）+ spec-31（IPC 限流）+ spec-33（Zod SoT）+ R8.A spec-11（权限提示）+ R8.B spec-04（drawer 系统）
> **blocks**: spec-22（注入录像）
> **decision_anchor**: V1-Q-7.G.2 答 C+D（CSV alias + AI 自报告 ready）/ V1-Q-7.G.3 答 D（3 秒倒计时 + 严格模式）/ V1-Q-6.D.3 答 B+C+D（首次确认 + 白名单 + CSV 自动）/ V1-Q-18.A 11 失败模式
> **estimated_loc**: 1100
> **risk**: medium

---

## 1. motivation

```yaml
user_quote_v1_q_7_g_2: "C + D — 通过 CSV alias 选实例 + AI 自报告 ready 池"
user_quote_v1_q_7_g_3: "D — 3 秒倒计时 + 严格模式可选"
user_quote_v1_q_6_d_3: "B + C + D — 首次确认 + 白名单 + CSV 自动模式"
feedback_4: "注入永远精准到指定 alias 实例的输入框"

goals:
  - 4 种目标选择器：alias / ready-pool / csv-row-alias / pid|hwnd
  - 白名单：实例级（alias）+ 工具级（codex/claude/...）+ 项目级（cwd 前缀）
  - 倒计时：默认 3000ms，用户可调 0-30000；用户按 ESC 取消；点击确认按钮跳过
  - 严格模式：每次注入都需 explicit user click，关闭 csv 自动模式
  - 首次确认：第一次往某 alias 注入时 modal 询问，记忆 24h
  - ready-pool：AI 自报告 ready 状态的实例集合（spec-28 task layer state='waiting-input'）
  - 白名单存储 SQLite + sha256(alias) 哈希；记忆有效期可配（24h / 7d / permanent）
  - dry-run UI：注入前显示截屏 + 文本预览 + 倒计时 + 取消按钮
  - 与 R8.A spec-11 危险操作矩阵对齐：注入到 GUI 视为 'dangerous'，需要确认；注入到 CLI 视为 'sensitive'
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/inject/TargetResolver.ts
  - devhub/src/main/services/inject/selectors/AliasSelector.ts
  - devhub/src/main/services/inject/selectors/ReadyPoolSelector.ts
  - devhub/src/main/services/inject/selectors/CsvRowAliasSelector.ts
  - devhub/src/main/services/inject/selectors/PidHwndSelector.ts
  - devhub/src/main/services/inject/InjectWhitelistService.ts
  - devhub/src/main/services/inject/InjectWhitelistRepository.ts  # SQLite
  - devhub/src/main/services/inject/CountdownController.ts
  - devhub/src/main/services/inject/StrictModeGate.ts
  - devhub/src/main/services/inject/FirstTimeConfirmGate.ts
  - devhub/src/renderer/components/inject/InjectCountdownModal.tsx
  - devhub/src/renderer/components/inject/InjectWhitelistDrawer.tsx
  - devhub/src/renderer/components/inject/InjectFirstTimeModal.tsx
  - devhub/src/renderer/components/inject/InjectDryRunPreview.tsx
  - devhub/src/main/services/inject/TargetResolver.test.ts
  - devhub/src/shared/schemas/inject-target.ts
  - devhub/src/shared/schemas/inject-whitelist.ts
modified_files:
  - devhub/src/main/services/inject/InjectService.ts  # 调用 TargetResolver + Gates
  - devhub/src/main/ipc/injectHandlers.ts
  - devhub/src/main/index.ts
glob_anchors:
  - devhub/src/main/services/permission/PermissionPromptService.ts  # R8.A spec-11
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'

export const InjectSelectorKindSchema = z.enum(['alias', 'ready-pool', 'csv-row-alias', 'pid', 'window-handle'])

export const InjectTargetSchema = z.object({
  selector: InjectSelectorKindSchema,
  aliasOrId: z.string(),
  pid: z.number().int().positive().optional(),
  hwnd: z.number().int().optional(),
  resolvedPid: z.number().int().nullable(),
  resolvedHwnd: z.number().int().nullable(),
  resolvedAlias: z.string().nullable(),
  resolvedTool: z.enum(['codex', 'claude', 'gemini', 'cursor', 'copilot']).nullable(),
})

export const WhitelistScopeSchema = z.enum(['instance', 'tool', 'project-cwd'])
export const WhitelistDurationSchema = z.enum(['session', '24h', '7d', 'permanent'])

export const WhitelistEntrySchema = z.object({
  id: z.string().uuid(),
  scope: WhitelistScopeSchema,
  pattern: z.string(),  // alias | tool 名 | cwd 前缀
  patternHash: z.string().regex(/^[a-f0-9]{64}$/),  // sha256 索引
  scenarios: z.array(z.enum([
  'csv-task-driven', 'watchdog-restart-resume', 'task-chain-next',
  'error-recovery', 'user-schedule', 'manual-template'
  ])),
  duration: WhitelistDurationSchema,
  createdAt: z.number().int(),
  expiresAt: z.number().int().nullable(),
  createdBy: z.enum(['user-explicit', 'first-time-modal', 'csv-mode-auto']),
  enabled: z.boolean().default(true),
})
export type WhitelistEntry = z.infer<typeof WhitelistEntrySchema>

export const StrictModeConfigSchema = z.object({
  enabled: z.boolean().default(false),
  applyToScenarios: z.array(z.string()).default(['manual-template', 'user-schedule']),
  bypassForCsvMode: z.boolean().default(false),  // 严格模式默认对 CSV 也生效
})

export const CountdownConfigSchema = z.object({
  defaultMs: z.number().int().min(0).max(30000).default(3000),
  perScenarioMs: z.record(z.string(), z.number().int()).optional(),
  showProgressBar: z.boolean().default(true),
  allowEscToCancel: z.boolean().default(true),
})

export const ResolveTargetResultSchema = z.object({
  ok: z.boolean(),
  target: InjectTargetSchema.optional(),
  whitelistGate: z.enum(['allowed', 'denied-not-listed', 'denied-expired', 'first-time-needed']),
  strictModeGate: z.enum(['allowed', 'requires-explicit-confirm']),
  countdownMs: z.number().int(),
  reason: z.string().optional(),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  inject:resolve-target:
  rate_limit: medium_query
  req: { selector, aliasOrId, pid?, hwnd?, scenario, taskId? }
  resp: ResolveTargetResult
  inject:get-ready-pool:
  rate_limit: medium_query
  req: {}
  resp: { instances: Array<{ alias, pid, hwnd, tool, lastReadyAt }> }
  inject:get-whitelist:
  rate_limit: meta
  req: { scope?: WhitelistScope }
  resp: WhitelistEntry[]
  inject:add-whitelist:
  rate_limit: low_freq_op
  req: { scope, pattern, scenarios, duration }
  resp: { entry: WhitelistEntry }
  inject:remove-whitelist:
  rate_limit: low_freq_op
  req: { id: string }
  resp: { success: boolean }
  inject:configure-strict-mode:
  rate_limit: low_freq_op
  req: StrictModeConfig
  resp: { success: boolean }
  inject:configure-countdown:
  rate_limit: low_freq_op
  req: CountdownConfig
  resp: { success: boolean }
  inject:countdown-stream:
  direction: main->renderer
  streaming: true
  payload: { actionId, remainingMs, totalMs, cancellable: boolean }
  inject:countdown-cancel:
  rate_limit: medium_query
  req: { actionId: string }
  resp: { cancelled: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| 目标不存在/已退出 | E_NOT_FOUND |
| 白名单未授权 | E_INJECT_BLOCKED |
| 严格模式未确认 | E_PERMISSION_DENIED |
| ready-pool 为空 | E_NOT_FOUND |
| 倒计时被取消 | E_USER_CANCELLED |
| pid 与 alias 不匹配 | E_VALIDATION |
| hwnd 无效 IsWindow=false | E_NOT_FOUND |
| whitelist scope 非法 | E_VALIDATION |
| 限流 | E_RATE_LIMITED |

---

## 6. acceptance_gwt

```yaml
GWT-1 (alias 选择器精准):
  given: 同时运行 codex / claude / gemini，alias='claude-devhub'
  when: TargetResolver.resolve({selector:'alias', aliasOrId:'claude-devhub'})
  then:
  - resolvedTool === 'claude'
  - resolvedPid 为该 alias 实例 PID
  - resolvedHwnd 非空（claude code 窗口）

GWT-2 (ready-pool 选择):
  given: 3 个实例，仅 claude-3 task layer state='waiting-input'
  when: TargetResolver.resolve({selector:'ready-pool', aliasOrId:'any-claude'})
  then:
  - resolvedAlias === 'claude-3'
  - 不会选到其他正在 thinking/coding 的实例

GWT-3 (白名单首次询问):
  given: alias='codex-1' 从未注入过，scenario='manual-template'
  when: inject:resolve-target
  then:
  - whitelistGate === 'first-time-needed'
  - UI 弹 InjectFirstTimeModal
  - 用户选"加入白名单 24h" → SQLite 写一条 WhitelistEntry duration='24h'

GWT-4 (白名单过期):
  given: alias='codex-1' 24h 白名单已 23h59m
  when: 25h 后再次 inject
  then: whitelistGate === 'denied-expired' + 提示重新授权

GWT-5 (严格模式拦截):
  given: StrictModeConfig.enabled=true, scenario='csv-task-driven', bypassForCsvMode=false
  when: inject:resolve-target
  then:
  - strictModeGate === 'requires-explicit-confirm'
  - UI 弹倒计时 + 必须用户点击"确认"

GWT-6 (倒计时 ESC 取消):
  given: action 进入倒计时 3s
  when: 用户在 1.5s 时按 ESC
  then:
  - inject:countdown-cancel 触发
  - InjectAction.status='cancelled'
  - 不实际注入

GWT-7 (csv-mode 跳过倒计时):
  given: scenario='csv-task-driven', whitelist 已含
  when: 启动批次
  then:
  - countdownMs=0（CSV 自动模式）
  - 直接注入，无 modal

GWT-8 (project-cwd scope 白名单):
  given: WhitelistEntry scope='project-cwd', pattern='D:/Projects/myapp'
  when: 实例 cwd='D:/Projects/myapp/sub'
  then: 白名单匹配（前缀），allowed

GWT-9 (pid/hwnd 强制 + alias 不匹配):
  given: target.pid=1234，但 1234 进程的 alias 不等于 target.aliasOrId
  when: TargetResolver.resolve
  then: E_VALIDATION + 拒绝（防止误注入到其他进程）
```

---

## 7. e2e_playwright_draft

```typescript
// tests/e2e/r8.c-spec-19-inject-targets.spec.ts
test('GWT-3 first-time confirm modal', async ({ page }) => {
  await page.evaluate(async () => {
  return await window.electronAPI.inject.resolveTarget({
  selector: 'alias',
  aliasOrId: 'codex-fresh',
  scenario: 'manual-template',
  })
  })
  await expect(page.locator('[data-testid="inject-first-time-modal"]')).toBeVisible()
  await page.click('[data-testid="whitelist-duration-24h"]')
  await page.click('[data-testid="inject-first-time-confirm"]')
  const list = await page.evaluate(() => window.electronAPI.inject.getWhitelist({}))
  expect(list.find((e: any) => e.pattern === 'codex-fresh')).toBeDefined()
})

test('GWT-6 ESC cancels countdown', async ({ page }) => {
  await page.evaluate(() => window.electronAPI.inject.execute({
  scenario: 'manual-template',
  target: { selector: 'alias', aliasOrId: 'allowed-1' },
  text: 'hi',
  countdownMs: 3000,
  confirmedBy: 'user-explicit',
  mode: 'clipboard-paste',
  }))
  await page.waitForSelector('[data-testid="inject-countdown-modal"]')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => (window as any).__lastInjectStatus === 'cancelled')
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'better-sqlite3@11.x':  whitelist 持久化
  - 'systeminformation@5.x':  pid → alias 映射
  - 'win-window-info@x':  hwnd → pid 映射
  - 'crypto':  sha256 哈希
  - 'path':  cwd 前缀匹配
  - 'react-aria-modal@x':  a11y 友好 modal
inspirations:
  - "1Password autofill 白名单 + scope"
  - "Bitwarden 'always allow'/'allow once'"
  - "macOS Accessibility / Screen Recording 权限矩阵（受 Apple 启发）"
  - "Anthropic Claude Code 桌面端的 'allow editing' 流程"
sqlite_schema_whitelist:
  - whitelist_entries (id TEXT PK, scope TEXT, pattern TEXT, patternHash TEXT, scenarios TEXT, duration TEXT, createdAt INT, expiresAt INT, createdBy TEXT, enabled INT)
  - INDEX (patternHash, scope, enabled), (expiresAt) for cleanup
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~700
modified_loc: ~80
test_loc: ~320
total: ~1100
risk_areas:
  - alias 唯一性保证（同 tool 多实例时）
  - cwd 前缀匹配的边界（symlink / 大小写）
  - 严格模式与 CSV 自动模式的优先级冲突
  - 24h 过期的时区处理（永远用 UTC epoch）
```

---

## 10. implement_checklist

- [x] TargetResolver 串联 4 selector + 白名单 gate + 严格模式 gate + countdown
- [x] AliasSelector 通过 spec-15 task queue / spec-12 csv driver 维护 alias↔pid↔hwnd 映射表
- [x] ReadyPoolSelector 订阅 spec-28 三层状态机 task layer state='waiting-input' 实例
- [x] CsvRowAliasSelector 从 task row.alias 推导，验证 row.alias 在 alias 池中
- [x] PidHwndSelector 严格双向校验：pid → alias, hwnd → pid 必须一致
- [x] FirstTimeConfirmGate：sha256(alias)+sha256(scenario) 查 SQLite，无记录 → 触发 modal
- [x] StrictModeGate：每次都强制要求 explicit confirm（除非 bypassForCsvMode=true）
- [x] CountdownController：emit countdown-stream 每 100ms
- [x] InjectCountdownModal：进度条 + 倒计时数字 + ESC 取消 + 立即注入按钮
- [x] InjectWhitelistDrawer（R8.B spec-04 drawer 系统集成）：列表 + 添加 + 删除 + 过期提示
- [x] InjectFirstTimeModal：3 个时长选项（session / 24h / 7d / permanent）+ scope 选择
- [x] feature flag `R8.C.inject.targets` 默认 ON；`R8.C.inject.targets.strict-mode` 默认 OFF
- [x] audit log: whitelist add/remove/expire + first-time confirm + strict-mode block
- [x] cleanup job：每小时扫描 expiresAt < now 标记 disabled
- [x] vitest fixture: 4 selector × 3 schema-valid scope × 4 duration 组合

---

## 11. dependencies

```yaml
upstream:
  - spec-18: InjectService 调用本服务做 gate
  - spec-31: IPC 限流
  - spec-33: Zod SoT
  - R8.A spec-11: 危险操作权限矩阵（注入归 'dangerous'）
  - R8.B spec-04: drawer 系统（whitelist UI）
  - spec-28: ready-pool 依赖 task layer state
downstream:
  - spec-22: 录像绑定 target 信息
  - spec-30: 通知白名单过期 + 严格模式拦截
```

---

## 12. fallback_strategy

```yaml
on_alias_collision:
  - 同名 alias 多实例 → 拒绝注入并提示重命名
on_ready_pool_empty:
  - 通知用户"无 ready 实例"
  - scenario=csv-task-driven 时 task 进入 awaiting-human
on_whitelist_db_corrupt:
  - 备份 + 重建空白 whitelist
  - 所有 inject 进入 first-time 流程
on_user_cancel_repeated:
  - 同一 actionId 30 分钟内取消 ≥ 3 次 → 临时 deny + 通知用户检查 alias 是否正确
flag_off_behavior:
  - R8.C.inject.targets=OFF → spec-18 退化到 R7 时代任意 hwnd 都接受（不推荐，仅调试）
```

---

## 13. performance_budget

```yaml
target_resolve_p95_ms: 50
whitelist_query_p99_ms: 5
ready_pool_query_p99_ms: 30
countdown_emit_interval_ms: 100
modal_render_p95_ms: 80
sqlite_write_p99_ms: 5
cleanup_job_interval_ms: 3600000
strict_mode_gate_p99_ms: 5
first_time_modal_render_p95_ms: 100
ipc_channel: inject:resolve-target → spec-31 medium_query 60 RPM
ipc_channel: inject:countdown-stream → spec-31 high_freq_scan 30 RPM（聚合）
whitelist_entries_max: 1000
```

---

## 14. implementation_status_2026_05_11_inject_target_resolver_sync

```yaml
status: inject_target_resolver_partial_verified
implemented:
  - Strengthened InjectTargetResolver selector semantics for alias, ready-pool, csv-row-alias, pid, and window-handle requests while preserving the existing resolver boundary.
  - CSV row alias selection now resolves only through rowAlias-to-runtime-alias mappings and no longer treats the raw runtime alias as an implicit csv-row-alias fallback.
  - PID and window-handle selectors now require concrete pid or hwnd inputs before alias verification, returning E_VALIDATION for incomplete selector requests.
  - Tightened project-cwd whitelist matching to exact path or descendant path boundaries so sibling directories that only share a string prefix are not allowed.
  - Whitelist, strict-mode, and countdown gates remain chained through the shared Zod ResolveTargetResult contract.
  - Feature-flag coverage now verifies R8.C.inject.targets default ON and R8.C.inject.targets.strict-mode default OFF with explicit user override support.
  - Added docs/r8/inject-targets.md to document verified selector behavior, safety gates, and open boundaries.
verified_by:
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts src/main/services/inject/InjectService.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 passed: 3 files / 20 tests.
  - pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts src/main/services/inject/InjectService.test.ts src/main/services/R8RuntimeService.test.ts src/shared/schemas/r8-runtime.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/preload/preloadContract.test.ts src/shared/feature-flags.test.ts --maxWorkers=1 -t "target|Target|inject|Inject|whitelist|strict|countdown|default disabled states|feature flag|preload|IPC|schema" passed: 7 files / 42 tests, 94 skipped by filter.
known_boundaries:
  - Alias mappings are still supplied by the caller rather than maintained directly from spec-15 task queue or spec-12 CSV driver subscriptions.
  - Ready-pool records read ready/state fields but do not yet subscribe directly to the spec-28 three-layer state machine.
  - First-time confirmation modal, SQLite whitelist repository, countdown modal UI, whitelist drawer, cleanup job, central audit rows, full selector/scope/duration fixture matrix, and renderer E2E remain open and are not claimed complete.
```

## 15. implementation_status_2026_05_18_countdown_controller_stream

```yaml
status: countdown_controller_stream_partial_verified
implemented:
  - R8RuntimeService now executes the CountdownController responsibility directly inside the existing runtime boundary: resolve target/whitelist/strict-mode gate, emit inject:countdown-stream scheduled/tick/completed every 100ms, then call the real InjectService execution path.
  - inject:countdown-cancel is wired into the active countdown loop. Cancellation emits a cancelled stream payload and returns a status=cancelled InjectResult without reaching native execution.
  - The stream payload is a shared Zod SoT contract and is exposed to renderer code through window.devhub.r8.inject.onCountdownStream(callback), with cleanup support.
verified_by:
  - pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "countdown|R8 IPC|injection dry-run" passed: 1 runtime file / 3 tests, schema file skipped by filter.
  - pnpm -C devhub exec vitest run src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "R8.B and R8.C IPC|orchestration result" passed: 1 file / 2 tests.
  - pnpm -C devhub typecheck passed.
  - pnpm -C devhub exec eslint src/shared/schemas/inject.ts src/shared/schemas/r8-runtime.ts src/shared/schemas/r8-runtime.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/preload/index.ts src/renderer/types/global.d.ts --max-warnings=0 passed.
  - pnpm -C devhub check:zod-sot passed.
  - pnpm -C devhub check:no-emoji passed.
known_boundaries:
  - Countdown modal rendering, ESC/立即注入 UI wiring, first-time confirmation store/modal, whitelist drawer, central audit rows, full selector/scope/duration fixture matrix, and renderer E2E remain open.
```

## 16. implementation_status_2026_05_18_whitelist_cleanup_and_matrix

```yaml
status: partial_verified
closed_checklist:
  - cleanup job：每小时扫描 expiresAt < now 标记 disabled
implemented:
  - `devhub/src/main/services/R8RuntimeService.ts` starts an hourly inject whitelist cleanup job during runtime construction, runs an initial startup cleanup pass, and stops the timer during `dispose()`.
  - `R8RuntimeService.cleanupExpiredInjectWhitelist()` disables expired enabled entries instead of deleting them, returns the disabled ids, and records `whitelist-expire` audit history entries with whitelist id, scope, pattern hash, and source.
  - `R8RuntimeService.addInjectWhitelist()` and `removeInjectWhitelist()` now record `whitelist-add` and `whitelist-remove` audit history entries; strict-mode target resolution records `strict-mode-block` entries when it blocks execution.
  - `session` whitelist duration no longer expires immediately by wall-clock comparison. It is valid inside the current runtime process and is cleaned on a later runtime startup through the session-start boundary.
  - `devhub/src/main/services/inject/InjectTargetResolver.test.ts` adds a real resolver matrix across 4 selector shapes, the 3 schema-valid whitelist scopes, and 4 durations. This intentionally uses the current Zod scope enum rather than inventing a fourth invalid scope.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "InjectTargetResolver|inject whitelist expiry cleanup|injection whitelist"` passed on 2026-05-18 with 14 tests.
  - `pnpm -C devhub exec eslint src/main/services/inject/InjectTargetResolver.ts src/main/services/inject/InjectTargetResolver.test.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts` passed on 2026-05-18.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub check:zod-sot` passed on 2026-05-18.
  - `pnpm -C devhub check:no-emoji` passed on 2026-05-18.
remaining_boundaries:
  - This slice closed the cleanup-job checkbox and partially advanced audit evidence. At this slice boundary, first-time confirmation modal persistence was still open; it is superseded by implementation_status_2026_05_18_first_time_confirm_ui_drawer.
  - The original fixture wording said 4 scopes, but the same spec and shared Zod contract define exactly 3 whitelist scopes. The verified matrix covers all schema-valid scopes without fabricating an invalid fourth scope.
```

## 17. implementation_status_2026_05_18_first_time_confirm_ui_drawer

```yaml
status: partial_verified
closed_checklist:
  - FirstTimeConfirmGate：sha256(alias)+sha256(scenario) 查 SQLite，无记录 → 触发 modal
  - InjectCountdownModal：进度条 + 倒计时数字 + ESC 取消 + 立即注入按钮
  - InjectWhitelistDrawer（R8.B spec-04 drawer 系统集成）：列表 + 添加 + 删除 + 过期提示
  - InjectFirstTimeModal：3 个时长选项（session / 24h / 7d / permanent）+ scope 选择
  - audit log: whitelist add/remove/expire + first-time confirm + strict-mode block
implemented:
  - `devhub/src/main/services/inject/InjectFirstTimeConfirmRepository.ts` persists first-time confirmations in real SQLite through `better-sqlite3`, stores sha256 alias/scenario indexes, and exposes session-duration filtering through the current runtime session boundary.
  - `R8RuntimeService.confirmInjectFirstTime()` resolves the real target, maps `instance` / `tool` / `project-cwd` scope to the same whitelist entry contract, records `first-time-confirm` plus `whitelist-add` audit history, and reuses the persisted entry as whitelist evidence on later resolution.
  - `R8RuntimeService.resolveInjectTarget()` broadcasts `inject:first-time-required` when a first-time gate is reached, and the shared IPC/preload contract now includes `inject:first-time-confirm`, `inject:first-time-required`, and `inject:countdown-complete`.
  - `InjectCountdownModal` subscribes to the real countdown stream, renders progress plus remaining time, supports ESC cancellation, and uses the IPC bridge for immediate injection instead of bypassing runtime state.
  - `InjectFirstTimeModal` subscribes to first-time-required events, presents `session` / `24h` / `7d` / `permanent` duration choices and `instance` / `tool` / `project-cwd` scope choices, then writes through the preload bridge.
  - `InjectWhitelistDrawer` is registered in the existing R8.B drawer system and uses the real preload whitelist bridge for list, add, remove, and expired-entry display.
verified_by:
  - `pnpm -C devhub exec vitest run src/preload/preloadContract.test.ts src/shared/schemas/r8-runtime.test.ts --maxWorkers=1 -t "preload whitelist|inject:|countdown|first-time|channel"` passed on 2026-05-18 with 2 files / 6 tests.
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectFirstTimeConfirmRepository.test.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/inject/InjectSafetyModal.test.tsx --maxWorkers=1 -t "first-time|inject whitelist expiry cleanup|injection whitelist|inject safety UI"` passed on 2026-05-18 with 3 files / 8 tests.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec eslint src/main/services/inject/InjectFirstTimeConfirmRepository.ts src/main/services/inject/InjectFirstTimeConfirmRepository.test.ts src/main/services/inject/index.ts src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.ts src/shared/schemas/inject.ts src/shared/schemas/r8-runtime.ts src/preload/index.ts src/renderer/types/global.d.ts src/renderer/App.tsx src/renderer/components/inject/InjectCountdownModal.tsx src/renderer/components/inject/InjectFirstTimeModal.tsx src/renderer/components/inject/InjectWhitelistDrawer.tsx src/renderer/components/inject/InjectSafetyModal.test.tsx src/renderer/components/drawer/drawer-model.ts src/renderer/components/drawer/DrawerContentRegistry.tsx src/renderer/components/drawer/DrawerContentModules.tsx src/renderer/components/monitor/R8OpsPanel.tsx` passed on 2026-05-18.
  - `pnpm -C devhub check:zod-sot` passed on 2026-05-18.
  - `pnpm -C devhub check:no-emoji` passed on 2026-05-18.
remaining_boundaries:
  - Renderer E2E for countdown, first-time confirmation, and whitelist drawer is superseded by implementation_status_2026_05_18_renderer_e2e_closure.
```

## 18. implementation_status_2026_05_18_scope_matrix_reconciliation

```yaml
status: partial_verified
closed_checklist:
  - vitest fixture: 4 selector × 3 schema-valid scope × 4 duration 组合
implemented:
  - Reconciled the historical `4 scope` wording with the authoritative contract in this same spec and in `devhub/src/shared/schemas/inject.ts`, where `WhitelistScope` is limited to `instance`, `tool`, and `project-cwd`.
  - Kept the existing executable matrix as the source of truth: 4 selector shapes, all 3 schema-valid whitelist scopes, and 4 durations.
  - Did not add a fake fourth scope or loosen runtime validation, preserving Zod SoT consistency.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectTargetResolver.test.ts --maxWorkers=1 -t "selector, whitelist scope, and duration matrix|project-cwd|exact alias|ready-pool|csv-row-alias|pid"` passed on 2026-05-18 with 1 file / 5 tests.
remaining_boundaries:
  - Renderer E2E for countdown, first-time confirmation, and whitelist drawer is superseded by implementation_status_2026_05_18_renderer_e2e_closure.
```

## 19. implementation_status_2026_05_18_alias_ready_pool_sources

```yaml
status: partial_verified
closed_checklist:
  - AliasSelector 通过 spec-15 task queue / spec-12 csv driver 维护 alias↔pid↔hwnd 映射表
  - ReadyPoolSelector 订阅 spec-28 三层状态机 task layer state='waiting-input' 实例
implemented:
  - `R8RuntimeService.listInjectTargetRecords()` now consumes active `AITaskTracker.getActiveTasks()` records as the authoritative alias source for live AI instances, including alias, pid, hwnd, tool, task id, monitor state, and readiness timestamp.
  - Runtime CSV/task-queue rows remain part of the target record merge so `csv-row-alias` continues to resolve through real queued task rows instead of raw alias fallback.
  - Target record merge now de-duplicates compatible records by alias while preserving pid/hwnd-rich active task data, preventing whitelist fallback records from creating false alias collisions.
  - `StateMachineCoordinator.listStates()` exposes the real three-layer state-machine snapshots, and R8RuntimeService projects `task=awaiting-input` to the inject resolver `waiting-input` ready-pool contract.
  - Ready-pool resolution now sees both active AI monitor-state `waiting-input` records and spec-28 task-layer awaiting-input records without fabricating target rows.
verified_by:
  - `pnpm -C devhub exec vitest run src/main/services/R8RuntimeService.test.ts --maxWorkers=1 -t "active AI aliases|injection whitelist|first-time|inject whitelist expiry cleanup"` passed on 2026-05-18 with 1 file / 4 tests.
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec eslint src/main/services/R8RuntimeService.ts src/main/services/R8RuntimeService.test.ts src/main/services/state/StateMachineCoordinator.ts` passed on 2026-05-18.
remaining_boundaries:
  - Renderer E2E for countdown, first-time confirmation, and whitelist drawer is closed by implementation_status_2026_05_18_renderer_e2e_closure.
```

## 20. implementation_status_2026_05_18_renderer_e2e_closure

```yaml
status: renderer_e2e_verified
closed_checklist:
  - Renderer E2E for countdown modal, first-time confirmation modal, and whitelist drawer.
implemented:
  - `devhub/e2e/example.spec.ts` adds a packaged Electron fixture that uses the real preload bridge instead of synthetic renderer events.
  - The fixture creates a real dry-run CSV queued task through `window.devhub.r8.csv.enqueueRow()` and resolves the target alias `codex-${taskId}` through `inject:resolve-target`.
  - The real first-time gate opens `InjectFirstTimeModal`; selecting `24h` plus `instance` persists through `inject:first-time-confirm`.
  - `R8RuntimeService.confirmInjectFirstTime()` now synchronizes the confirmed repository entry into the Electron Store fallback after repository confirm, so a packaged-runtime `better-sqlite3` ABI failure cannot make the approved whitelist invisible to the resolver or drawer.
  - `InjectFirstTimeModal` emits a local whitelist-changed event after a successful confirmation, and `InjectWhitelistDrawer` refreshes mounted content from the real preload whitelist bridge when that event fires. This closes the stale-open-drawer case where a persisted entry existed but the drawer had already cached an empty list.
  - R8 Ops opens the existing R8.B drawer entry `open-inject-whitelist-drawer`, and `InjectWhitelistDrawer` renders the persisted target alias through the real whitelist bridge.
  - `inject:execute` starts the real countdown stream; pressing Escape cancels through `inject:countdown-cancel` and returns a real `InjectResult` with `status=cancelled`, `success=false`, the resolved target alias, and `E_CANCELLED:inject countdown cancelled`.
verified_by:
  - `pnpm -C devhub typecheck` passed on 2026-05-18.
  - `pnpm -C devhub exec vitest run src/main/services/inject/InjectFirstTimeConfirmRepository.test.ts src/main/services/R8RuntimeService.test.ts src/renderer/components/inject/InjectSafetyModal.test.tsx --maxWorkers=1 -t "first-time|inject whitelist expiry cleanup|injection whitelist|inject safety UI"` passed on 2026-05-18 with 3 files / 8 tests.
  - `pnpm -C devhub build` passed on 2026-05-18 with only the known Monaco dynamic/static import warning.
  - `pnpm -C devhub test:e2e --grep "R8.C spec-19" --reporter=line --workers=1` passed on 2026-05-18 with 1 packaged Electron test.
remaining_boundaries:
  - Spec-19 target management no longer has a renderer E2E boundary.
  - UIA adapter behavior and task-queue/watchdog trigger E2E remain under `spec-18-auto-inject.md` or cross-spec inject follow-up, not this target-management spec.
```
