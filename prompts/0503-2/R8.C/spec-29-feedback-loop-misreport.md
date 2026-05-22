# spec-29-feedback-loop-misreport — 误报反馈循环（用户主动校正信号）

> **batch**: R8.C  |  **flag**: `R8.C.feedback.loop`
> **depends_on**: R8.C spec-27 (fusion), R8.C spec-28 (state machine)
> **derives_from**: V1-Q-7.A.7 答 D 用户标记 + V2-Q-15.E + feedback#4 错报修正

---

## 1. motivation

```yaml
user_quote_v1_q_7_a_7: "D — 用户在监控窗口可一键标记'误报'，DevHub 学习并调整权重"
feedback_4: "误报/瞎报/错报 — 需要用户参与的反馈通道"
goals:
  - 监控窗口 ToolCard 提供"误报"按钮（→ ai:report-misreport）
  - 标记后写入 MisreportLog；下次相似信号组合权重微调
  - 不联网（NO-TELEMETRY）；学习仅本地
  - 提供"为什么显示空闲"诊断面板（信号贡献 + 状态翻转历史）
constraint:
  - 学习算法保守：单次反馈调权 ≤ 5%
  - 用户可一键 reset 学习曲线
  - 反馈数据脱敏写入 audit log
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/feedback/MisreportLogger.ts
  - devhub/src/main/services/feedback/WeightAdjuster.ts
  - devhub/src/main/services/feedback/DiagnosticExplain.ts
  - devhub/src/main/services/feedback/MisreportLogger.test.ts
  - devhub/src/renderer/views/monitor/MisreportButton.tsx
  - devhub/src/renderer/views/monitor/SignalDiagnosticPanel.tsx
  - devhub/src/shared/schemas/misreport.ts
modified_files:
  - devhub/src/main/services/R8RuntimeService.ts  # report/list/explain/reset bridge, local learning weights, audit
  - devhub/src/main/ipc/r8RuntimeHandlers.ts  # executable spec-29 IPC handlers
  - devhub/src/preload/index.ts  # typed renderer bridge
  - devhub/src/renderer/types/global.d.ts  # renderer global API typing
  - devhub/src/renderer/components/monitor/WindowView.tsx  # AI card misreport button and diagnostic panel entry
  - devhub/src/shared/schemas/r8-runtime.ts  # Zod registry and IPC feature mapping
  - devhub/package.json  # better-sqlite3 and types
compatibility_notes:
  - SignalFusion remains dependency-light; learned weights are applied through R8RuntimeService.getActiveWeightProfile before fusion.
  - No telemetry is introduced; misreports and learning adjustments are stored only under Electron userData.
glob_anchors:
  - devhub/src/main/services/R8RuntimeService.ts:2310-2375
  - devhub/src/renderer/components/monitor/WindowView.tsx:1120-1290
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { SignalContributionSchema } from '@/shared/schemas/signal-fusion'

export const MisreportKindEnum = z.enum([
  'false-idle',  // 实际在跑但显示 idle
  'false-thinking',  // 实际空闲但显示 thinking
  'false-progress',  // 进度数字明显错
  'false-completion',  // 标完成但实际没完
  'false-error',  // 标错但实际没错
])

export const MisreportRecordSchema = z.object({
  id: z.string().uuid(),
  instanceId: z.string(),
  kind: MisreportKindEnum,
  reportedBy: z.string(),  // 用户 ID 或 'self'
  reportedAt: z.number().int(),
  signalSnapshot: SignalContributionSchema,
  userNote: z.string().max(500).optional(),
  expectedTaskState: z.enum(['idle','thinking','running','awaiting-input','completed','error']).optional(),
})

export const WeightAdjustmentSchema = z.object({
  source: z.enum(['cli_parse','window_title','process_cpu_io','file_mtime','network_active','user_input_event']),
  oldWeight: z.number(),
  newWeight: z.number(),
  delta: z.number().refine(v => Math.abs(v) <= 0.05, { message: 'single feedback ≤ 5%' }),
  triggeredByMisreportId: z.string().uuid(),
  appliedAt: z.number().int(),
})

export const DiagnosticExplainSchema = z.object({
  instanceId: z.string(),
  currentTaskState: z.string(),
  topReasons: z.array(z.object({
  reasonText: z.string(),  // 人话
  sourceCitation: z.string(),  // 哪个信号源
  contributionPct: z.number(),
  })).max(5),
  recentTransitions: z.array(z.unknown()).max(10),
  suggestedAction: z.enum(['wait','restart-instance','toggle-shim','adjust-weights','report-misreport']),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  ai:report-misreport:
  req: { instanceId: string, kind: MisreportKind, userNote?: string, expectedTaskState?: string }
  resp: { id: string, weightAdjustments: WeightAdjustment[] }
  ai:get-diagnostic-explain:
  req: { instanceId: string }
  resp: DiagnosticExplain
  ai:list-misreports:
  req: { since?: number }
  resp: MisreportRecord[]
  ai:reset-learned-weights:
  resp: { success: boolean, profileResetTo: 'default' }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| instanceId 不存在 | E_NOT_FOUND |
| kind 未知 | E_VALIDATION |
| 同 instance 1 分钟内重复反馈 | E_RATE_LIMITED（保守，防滥用） |
| weight delta 越界（> 5%） | E_VALIDATION（自动 clip） |
| log 写盘失败 | E_INTERNAL（不阻塞 UI） |

---

## 6. acceptance_gwt

```yaml
GWT-1 (基础反馈):
  given: 用户在监控窗 claude 卡片标"false-idle"
  when: ai:report-misreport
  then:
  - MisreportRecord 落盘
  - cli_parse 权重微调（如低估则 +2%）
  - audit log 记录

GWT-2 (诊断面板):
  given: instance idle 显示但用户疑惑
  when: ai:get-diagnostic-explain
  then:
  - topReasons 含 ≤ 5 条人话解释（如"30s 无 cli 信号 + window 标题为 idle"）
  - suggestedAction='toggle-shim' 或 'report-misreport'

GWT-3 (学习上限):
  given: 用户连续 10 次反馈 'false-idle'
  when: 累计调权
  then: cli_parse 权重涨幅累计 ≤ 20%（每次 ≤ 5%，保守）

GWT-4 (重置):
  given: 用户调权后悔
  when: ai:reset-learned-weights
  then: 回到 default profile；audit log 记录

GWT-5 (限频):
  given: 用户 30s 内 5 次重复反馈
  when: ai:report-misreport
  then: 第 2 次起 E_RATE_LIMITED；UI toast 提示
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 misreport adjusts weight', async ({ page }) => {
  await page.evaluate(() => window.electronAPI.ai.reportMisreport({
  instanceId: 'cl-1', kind: 'false-idle', expectedTaskState: 'thinking'
  }))
  const profiles = await page.evaluate(() => window.electronAPI.ai.listWeightProfiles())
  const learned = profiles.find((p: any) => p.profileId === 'user-custom')
  expect(learned.weights.cli_parse).toBeGreaterThan(0.8)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'better-sqlite3@11.x':  misreport log 持久化
  - 'zod@3.23':  schema
weight_adjustment_algo: |
  // 极保守：每次反馈 delta = sign * min(0.05, base_delta)
  if (kind === 'false-idle' && expected === 'thinking'):
  proposed = +0.03 * cli_parse + -0.015 * window_title + -0.015 * process_cpu_io
  // clip to [0, 1]; renormalize sum to 1.0
inspirations:
  - Spotify "thumbs down" feedback loop
  - VSCode language model feedback
  - Anthropic Workbench "report response" UI
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~720
modified_loc: ~140
test_loc: ~360
total: ~1220
risk_areas:
  - 学习曲线发散（用户胡乱标记）
  - SQLite 写性能（高频反馈）
  - 隐私：误报内容可能含敏感（user note）
```

---

## 10. implement_checklist

- [x] MisreportLogger 写 SQLite better-sqlite3
- [x] WeightAdjuster delta 上限 5%（zod refine）
- [x] DiagnosticExplain 生成 ≤ 5 条人话理由
- [x] MisreportButton 在 ToolCard 右上角；3s 倒计时防误点
- [x] SignalDiagnosticPanel 默认折叠，点开显示
- [x] reset-learned-weights 必须二次确认（不可恢复）
- [x] 限频：每 instance 每分钟 ≤ 1 次
- [x] 用户笔记 PII 脱敏写 audit log
- [x] vitest 覆盖 5 GWT + 边界 delta
- [x] feature flag R8.C.feedback.loop 默认 ON

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-27: signal contribution 用于诊断
  - R8.C.spec-28: state machine transition 用于诊断
downstream:
  - R8.C.spec-32: 观测面板显示 misreport 趋势
  - R8.C.spec-36: 诊断包导出含 misreport log
```

---

## 12. fallback_strategy

```yaml
on_sqlite_fail:
  - 降级到 JSONL 日志文件
on_explain_compute_fail:
  - 退化到模板文本"信号不足，请检查 SHIM 安装"
on_runaway_feedback:
  - 用户 1h 内 ≥ 50 次反馈 → 强制冷却 + 提示
flag_off_behavior:
  - R8.C.feedback.loop=OFF 时按钮隐藏；权重锁 default
```

---

## 13. performance_budget

```yaml
report_p99_ms: { warn: 100, fatal: 500 }
explain_compute_p99_ms: { warn: 200, fatal: 1500 }
sqlite_write_p99_ms: { warn: 50, fatal: 500 }
log_size_mb_per_30days: { warn: 20, fatal: 200 }
ipc_channel: ai:report-misreport → spec-31 low_freq_op 120 RPM
```

---

## 14. implementation_status_2026-05-05

```yaml
status: complete
implementation_mode: local-only feedback learning vertical slice
runtime_dependency: better-sqlite3@11.10.0 plus @types/better-sqlite3
feature_flag: R8.C.feedback.loop default ON through shared feature-flag registry
privacy: NO-TELEMETRY; user notes are stored locally and redacted in audit targets
verification_scope: schema + SQLite logger + weight adjuster + diagnostic explain + R8 runtime bridge + IPC + preload + renderer controls + full Vitest + lint + license + GitNexus impact
```

### Implemented Files

```yaml
feedback_core:
  - devhub/src/shared/schemas/misreport.ts
  - devhub/src/main/services/feedback/MisreportLogger.ts
  - devhub/src/main/services/feedback/WeightAdjuster.ts
  - devhub/src/main/services/feedback/DiagnosticExplain.ts
  - devhub/src/main/services/feedback/index.ts
runtime_bridge:
  - devhub/src/main/services/R8RuntimeService.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
renderer:
  - devhub/src/renderer/views/monitor/MisreportButton.tsx
  - devhub/src/renderer/views/monitor/SignalDiagnosticPanel.tsx
  - devhub/src/renderer/components/monitor/WindowView.tsx
tests:
  - devhub/src/main/services/feedback/MisreportLogger.test.ts
  - devhub/src/main/services/R8RuntimeService.test.ts
  - devhub/src/main/ipc/r8RuntimeHandlers.test.ts
  - devhub/src/shared/schemas/r8-runtime.test.ts
  - devhub/src/preload/preloadContract.test.ts
  - devhub/src/renderer/views/monitor/MisreportButton.test.tsx
  - devhub/src/renderer/views/monitor/SignalDiagnosticPanel.test.tsx
```

### GWT Mapping

- GWT-1: `ai:report-misreport` writes a real SQLite `MisreportRecord`, applies conservative local weight adjustments, and records a redacted audit row.
- GWT-2: `ai:get-diagnostic-explain` returns up to 5 human-readable top reasons from real signal contributions plus recent spec-28 transitions.
- GWT-3: `WeightAdjuster` enforces per-feedback delta <= 5% and cumulative per-source learning <= 20%.
- GWT-4: `ai:reset-learned-weights` requires `confirmedBy`, resets the active profile to `default`, clears learned adjustment totals, and writes audit.
- GWT-5: `MisreportLogger.latestForInstance` backs a one-feedback-per-instance-per-minute guard; duplicates throw `E_RATE_LIMITED`.

### Verification Evidence

Commands executed from `D:/Desktop/CREATOR ONE/devhub`:

```bash
pnpm test --run src/renderer/views/monitor/MisreportButton.test.tsx src/main/services/feedback/MisreportLogger.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/views/monitor/SignalDiagnosticPanel.test.tsx --maxWorkers=1
pnpm lint
pnpm check:license
pnpm test --run --maxWorkers=1
pnpm typecheck
npx gitnexus analyze --force
git restore -- AGENTS.md CLAUDE.md
npx gitnexus status
npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
npx gitnexus impact MisreportLogger --repo devhub --direction upstream --depth 2
npx gitnexus impact WeightAdjuster --repo devhub --direction upstream --depth 2
npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
npx gitnexus impact MisreportButton --repo devhub --direction upstream --depth 2
```

Results:

- Targeted spec-29 suite: 7 files passed, 73 tests passed with `--maxWorkers=1`.
- Lint and no-emoji gate: passed; `No emoji found in 398 files`.
- License check: passed; 421 production package entries validated and 1 manifest exception retained.
- Full Vitest: 82 files passed, 604 tests passed with `--maxWorkers=1`.
- Final TypeScript typecheck: passed.
- GitNexus analyze: indexed 4,563 nodes, 13,970 edges, 383 clusters, and 300 flows.
- GitNexus status: up to date for commit `de634f9`.
- Post-index impact: `R8RuntimeService` LOW, `MisreportLogger` LOW, `WeightAdjuster` LOW, `setupR8RuntimeHandlers` LOW, `MisreportButton` LOW.

### Completion Boundary

- Complete for spec-29 executable scope: local SQLite misreport log, conservative learned-weight update, duplicate feedback rate limit, diagnostic explain API, reset learned weights, redacted audit, preload/IPC typing, AI card misreport button, and default-collapsed diagnostic panel.
- Intentionally not claimed here: spec-32 trend visualization, spec-36 diagnostic pack inclusion, multi-user identity beyond local `reportedBy`, or cloud telemetry. Those are downstream or explicitly out of scope.
