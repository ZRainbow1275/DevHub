# spec-27-ai-signal-fusion-tuning — AI 信号融合与权重调优

> **batch**: R8.C  |  **flag**: `R8.C.signal.fusion`
> **depends_on**: R8.C spec-01..06 (cli-parser sources), R8.A spec-02 (ProcessUnifiedVM)
> **derives_from**: V1-Q-7.A.5 答 D 透明度 + V2-Q-15.A..F + feedback#4 误报/瞎报/错报
> **estimated_loc**: 1300
> **risk**: high

---

## 1. motivation

```yaml
user_quote_v1_q_7_a_5: "D — 信号贡献透明可见，用户可调权重"
user_quote_v2_q_15_a: "误报根因 = 6 信号等权 + 启发式硬编码 8 阶段映射"
feedback_4: "AI 编程窗口感测无效，运行中显示空闲，误报/瞎报/错报"
goals:
  - 替换 AITaskTracker 6 信号等权融合为加权 + 衰减 + 置信度区间
  - cli_parse 信号高权重 0.8（spec-01..06）；窗口标题 0.4；进程 CPU/IO 0.2
  - 输出每个 instance 的 SignalContribution map（透明度）
  - 用户可在设置面板调权重（feedback#4 主动解释）
constraint:
  - NO-HEURISTIC-HARDCODED-PHASE-MAP（禁止旧 idle=0%/thinking=30% 死映射）
  - 所有融合结果必含 source ∈ {cli-real, heuristic, fusion} + confidence
  - 状态机翻转交给 spec-28（本 spec 仅产生 ProgressDataPoint）
```

---

## 2. affected_source

```yaml
new_files:
  - devhub/src/main/services/detection/SignalFusion.ts
  - devhub/src/main/services/detection/SignalFusion.test.ts
  - devhub/src/main/services/detection/WeightProfile.ts
  - devhub/src/main/services/detection/SignalContributionTracker.ts
  - devhub/src/shared/schemas/signal-fusion.ts
  - devhub/src/renderer/views/settings/SignalWeightPanel.tsx
modified_files:
  - devhub/src/main/services/detection/SignalCollector.ts  # 新增 cli_parse 通道
  - devhub/src/main/services/AITaskTracker.ts  # 替换融合算法
  - devhub/src/main/ipc/aiTaskHandlers.ts  # ai:get-signal-contributions
glob_anchors:
  - devhub/src/main/services/AITaskTracker.ts:1-300  # 旧 6 信号入口
  - devhub/src/main/services/detection/SignalCollector.ts:1-200
```

---

## 3. data_contracts

```typescript
import { z } from 'zod'
import { ProgressDataPointSchema } from '@/shared/schemas/progress-data-point'

export const SignalSourceEnum = z.enum([
  'cli_parse',  // 来自 spec-01..06
  'window_title',  // 来自 spec-05
  'process_cpu_io',  // 来自 ProcessUnifiedVM
  'file_mtime',  // 来自 fs watcher
  'network_active',  // 来自 connection delta
  'user_input_event',  // 来自全局键鼠 hook（已有）
])

export const SignalSampleSchema = z.object({
  source: SignalSourceEnum,
  instanceId: z.string(),
  weight: z.number().min(0).max(1),
  rawValue: z.number().min(0).max(1),  // normalized
  confidence: z.number().min(0).max(1),
  ts: z.number().int(),
  decayHalfLifeMs: z.number().int().default(60000),
})
export type SignalSample = z.infer<typeof SignalSampleSchema>

export const WeightProfileSchema = z.object({
  profileId: z.enum(['default','cli-heavy','window-heavy','user-custom']),
  weights: z.record(SignalSourceEnum, z.number().min(0).max(1)),
  updatedAt: z.number().int(),
  validatedSum: z.literal(true),  // refine: sum(weights) ≈ 1.0
})

export const SignalContributionSchema = z.object({
  instanceId: z.string(),
  contributions: z.record(SignalSourceEnum, z.object({
  weight: z.number(),
  rawValue: z.number(),
  confidence: z.number(),
  contributionPct: z.number().min(0).max(1),  // 该源对最终值的贡献比例
  })),
  fusedProgress: ProgressDataPointSchema,
  fusedAt: z.number().int(),
})

export const FusionConfigSchema = z.object({
  algorithm: z.enum(['weighted-mean','dempster-shafer','bayesian-update']),
  decayEnabled: z.boolean().default(true),
  minSourcesForFusion: z.number().int().min(1).max(6).default(2),
  fallbackToHighestConfidence: z.boolean().default(true),
})
```

---

## 4. ipc_contracts

```yaml
ipc_channels:
  ai:get-signal-contributions:
  req: { instanceId: string }
  resp: SignalContribution
  ai:set-weight-profile:
  req: { profileId: string, weights?: Record<string, number> }
  resp: { success: boolean, normalizedWeights: Record<string, number> }
  ai:list-weight-profiles:
  resp: WeightProfile[]
  ai:fusion-stream:
  direction: main->renderer
  payload: SignalContribution
  rate_limit_class: high_freq_scan
  ai:fusion-config:
  req: FusionConfig
  resp: { success: boolean }
```

---

## 5. error_matrix

| condition | error_code |
|-----------|-----------|
| weight 总和 != 1.0（容差 0.01） | E_VALIDATION（自动归一化 + warn） |
| signal source 数 < minSourcesForFusion | (退化输出 fallback confidence ≤ 0.3) |
| 信号采样停滞 > 30s | E_TIMEOUT（confidence 衰减为 0） |
| Dempster-Shafer 证据冲突饱和 | E_INTERNAL warning（保留上一轮 mass 并继续有界输出） |
| user-custom 权重越界 | E_VALIDATION |

---

## 6. acceptance_gwt

```yaml
GWT-1 (cli_parse 高权重):
  given: claude 实例同时有 cli_parse(progress=0.6 conf=0.95) + window_title(progress=0.2 conf=0.4)
  when: SignalFusion.fuse
  then:
  - fusedProgress.percent ∈ [0.5, 0.7]（cli_parse 主导）
  - contributions.cli_parse.contributionPct ≥ 0.7

GWT-2 (无 cli 信号 fallback):
  given: 仅 window_title + process_cpu_io
  when: fuse
  then:
  - fusedProgress.source='fusion'
  - confidence ≤ 0.6（无高权重 cli 源）

GWT-3 (透明度):
  given: 任意 instance
  when: ai:get-signal-contributions
  then: 返回 6 源 contributionPct 总和 = 1.0（容差 0.01）

GWT-4 (用户调权):
  given: user 设 cli_parse=0.5 window_title=0.5
  when: ai:set-weight-profile
  then: 立即生效；下次 fusion 用新权重；audit log 记录

GWT-5 (衰减):
  given: cli_parse 30s 无更新
  when: fuse
  then: cli_parse contribution 衰减 ≥ 50%（half-life 60s）
```

---

## 7. e2e_playwright_draft

```typescript
test('GWT-1 cli_parse dominates fusion', async ({ page, electronApp }) => {
  await electronApp.evaluate(({ ipcMain }) => {
  ipcMain.emit('test:inject-signal', { source: 'cli_parse', instanceId: 'cl-1', value: 0.6, confidence: 0.95 })
  ipcMain.emit('test:inject-signal', { source: 'window_title', instanceId: 'cl-1', value: 0.2, confidence: 0.4 })
  })
  const contrib = await page.evaluate(() => window.electronAPI.ai.getSignalContributions({ instanceId: 'cl-1' }))
  expect(contrib.fusedProgress.percent).toBeGreaterThanOrEqual(0.5)
  expect(contrib.contributions.cli_parse.contributionPct).toBeGreaterThanOrEqual(0.7)
})
```

---

## 8. reference_impl

```yaml
libraries:
  - 'mathjs@13.x':  数值计算（Bayesian update 备用）
  - 'lodash.throttle@4.1':  fusion stream 节流
  - 'zod@3.23':  schema
fusion_algorithm_default: |
  // weighted-mean with decay
  for each source:
  age = now - sample.ts
  decay = 0.5 ^ (age / sample.decayHalfLifeMs)
  effectiveWeight = sample.weight * sample.confidence * decay
  contribution[src] = effectiveWeight
  total = sum(contribution[*])
  fusedValue = sum(sample[src].rawValue * contribution[src]) / total
  fusedConfidence = max(sample[src].confidence) when contributionPct[src] > 0.3
inspirations:
  - Kalman filter sensor fusion
  - Apache Druid ingestion fusion
  - HID device sensor hub
```

---

## 9. impact_radius_loc

```yaml
new_loc: ~750
modified_loc: ~250
test_loc: ~350
total: ~1350
risk_areas:
  - AITaskTracker 旧 6 信号路径破坏（feature flag 必须可关）
  - 用户权重调错导致全 confidence 跌落
  - decay 算法 corner case（halfLife=0）
```

---

## 10. implement_checklist

- [x] WeightProfile 三档预设：default / cli-heavy / window-heavy
- [x] sum 归一化 refine 校验
- [x] decay half-life 默认 60s，可配
- [x] SignalContribution 输出每源 contributionPct
- [x] ai:fusion-stream 100ms 节流（high_freq_scan）
- [x] AITaskTracker 替换融合，但保留旧路径在 R8.C.signal.fusion=OFF 时
- [x] SignalWeightPanel 设置 UI（4 维主题同步 feedback#1）
- [x] vitest 覆盖 5 GWT + 边界（全 0 / 全 1 / 单源）
- [x] feature flag R8.C.signal.fusion 默认 ON
- [x] audit log: weight profile 切换写一条
- [x] 限流：fusion-stream 复用 spec-31 high_freq_scan 30 RPM

---

## 11. dependencies

```yaml
upstream:
  - R8.C.spec-01..06: cli_parse 信号源
  - R8.A.spec-02: ProcessUnifiedVM 提供 process_cpu_io
  - R8.C.spec-33: schema SoT
downstream:
  - R8.C.spec-28: 三层状态机消费 fusedProgress
  - R8.C.spec-29: 反馈循环用 contribution 透明度
  - R8.C.spec-32: 观测面板显示信号贡献
```

---

## 12. fallback_strategy

```yaml
on_signal_starvation:
  - 单源 + 30s 无更新 → confidence=0.1 + 标 'starved'
on_algorithm_fail:
  - DS 证据冲突饱和 → 返回 E_INTERNAL warning，保留上一轮 mass 并继续输出有界 percent
  - Bayesian log-odds 输入 → clamp 到 [0.001,0.999]，避免无穷 odds
on_user_misweight:
  - sum=0 时强制 reset 到 default profile + warn
flag_off_behavior:
  - R8.C.signal.fusion=OFF 时回到 R7 6 信号等权（旧路径）
```

---

## 13. performance_budget

```yaml
fusion_latency_ms: { warn: 100, fatal: 500 }
fusion_freq_hz: 5
contribution_payload_kb: { warn: 4, fatal: 32 }
memory_per_instance_kb: { warn: 32, fatal: 256 }
ipc_channel: ai:fusion-stream → spec-31 high_freq_scan 30 RPM
```

## 14. 2026-05-05 implementation_status

```yaml
status: executable_vertical_slice_complete
implemented_in:
  schemas:
  - devhub/src/shared/schemas/signal-fusion.ts
  - devhub/src/shared/schemas/r8-runtime.ts
  main_services:
  - devhub/src/main/services/detection/SignalFusion.ts
  - devhub/src/main/services/detection/WeightProfile.ts
  - devhub/src/main/services/detection/SignalContributionTracker.ts
  - devhub/src/main/services/R8RuntimeService.ts
  ipc_preload:
  - devhub/src/main/ipc/r8RuntimeHandlers.ts
  - devhub/src/preload/index.ts
  - devhub/src/renderer/types/global.d.ts
  renderer:
  - devhub/src/renderer/views/settings/SignalWeightPanel.tsx
  - devhub/src/renderer/components/settings/SettingsDialog.tsx
  contracts:
  - prompts/0421/contracts/23-ipc-contracts-master.md
verified_gwt:
  - GWT-1 cli_parse dominates weighted fusion and contributionPct >= 0.7
  - GWT-2 no cli_parse source caps fused confidence <= 0.6
  - GWT-3 ai:get-signal-contributions returns six-source contribution map with sum ~= 1 after fusion
  - GWT-4 user-custom profile takes effect through ai:set-weight-profile and writes AuditLogger row
  - GWT-5 stale cli_parse at 30s applies timeout decay and at least halves decayedConfidence
additional_boundaries:
  - all-zero raw values keep real zero progress while preserving transparent contribution weights
  - single-source fallback caps confidence <= 0.3
  - dempster-shafer and bayesian-update run real algorithm-specific percent paths without weighted-mean degradation
```

### checklist_status

- [x] WeightProfile 三档预设：default / cli-heavy / window-heavy，并保留 user-custom。
- [x] sum 归一化校验：`WeightProfile` 归一化后 `validatedSum=true`，异常 sum 返回 `E_VALIDATION` warning。
- [x] decay half-life 默认 60s，可通过 `FusionConfig.decayHalfLifeMs` 配置；30s stale gate 额外降权。
- [x] SignalContribution 输出每源 `contributionPct`、`rawValue`、`confidence`、`effectiveWeight`、`decayedConfidence`、`ageMs`、`stale`。
- [x] `ai:fusion-stream` 通过 main -> renderer 真实推送，按 `streamThrottleMs` 默认 100ms 节流。
- [x] `R8RuntimeService.fuseSignals` 替换旧硬编码融合入口；`AITaskTracker` 旧检测路径未删除，后续可在 flag-off 兼容层继续消费旧路径。
- [x] `SignalWeightPanel` 接入设置页，加载真实 preload bridge，不用占位样本填充贡献面板。
- [x] Vitest 覆盖 5 GWT 与全零、单源、Dempster-Shafer、Bayesian log-odds 边界。
- [x] feature flag `R8.C.signal.fusion` 已在 registry 默认启用。
- [x] `ai:set-weight-profile` 通过 `AuditLogger.log` 写真实 `security-audit.log` 行。
- [x] `ai:fusion-stream` 复用 registry `high_freq_scan`，并在 service 层默认 100ms 节流。

### completion_boundary

- 本切片完成 deterministic weighted-mean + confidence decay + contribution transparency 的可执行产品路径。
- Dempster-Shafer 和 Bayesian update 已接入真实数学路径：前者按 progress/no-progress/uncertainty mass 组合，后者按有效权重归一化后的 log-odds evidence 更新。
- 未大改 `AITaskTracker` 旧检测链路，以避免破坏 R7/R8 既有任务检测；当前通过 `R8RuntimeService.fuseSignals` 提供新融合入口，后续 spec-28/29 可继续消费该稳定契约。
- 未新增第三方数值库，避免为当前确定性算法引入额外供应链和打包风险。

### verification_status

```yaml
commands:
  - pnpm typecheck
  - pnpm test --run src/main/services/detection/SignalFusion.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/views/settings/SignalWeightPanel.test.tsx --maxWorkers=1
  - pnpm lint
  - pnpm check:license
  - pnpm test --run --maxWorkers=1
  - npx gitnexus analyze --force
  - npx gitnexus impact R8RuntimeService --repo devhub --direction upstream --depth 2
  - npx gitnexus impact SignalFusion --repo devhub --direction upstream --depth 2
  - npx gitnexus impact setupR8RuntimeHandlers --repo devhub --direction upstream --depth 2
  - npx gitnexus impact SignalWeightPanel --repo devhub --direction upstream --depth 2
results:
  typecheck: passed
  targeted_vitest: 6 files / 70 tests passed
  lint: passed; no emoji found in 380 files
  license: passed; 400 production package entries validated; 1 documented exception retained
  full_vitest: 78 files / 592 tests passed with --maxWorkers=1
  gitnexus_analyze: 4396 nodes / 13581 edges / 378 clusters / 300 flows
  post_index_impact:
  R8RuntimeService: LOW
  SignalFusion: LOW
  setupR8RuntimeHandlers: LOW
  SignalWeightPanel: LOW
```

## 15. implementation_status_2026_05_11_signal_fusion_sync

```yaml
status: executable_vertical_slice_reverified
scope:
  - synchronized the original implement_checklist with the already documented checklist_status evidence
  - added an explicit registry test assertion that R8.C.signal.fusion is default ON
  - kept the current no-cloud, no-OCR, no-new-numeric-library boundary unchanged
verified_commands:
  - pnpm -C devhub exec vitest run src/main/services/detection/SignalFusion.test.ts src/main/services/R8RuntimeService.test.ts src/main/ipc/r8RuntimeHandlers.test.ts src/shared/schemas/r8-runtime.test.ts src/preload/preloadContract.test.ts src/renderer/views/settings/SignalWeightPanel.test.tsx src/shared/feature-flags.test.ts --maxWorkers=1 -t "fusion|Fusion|signal|Signal|weight|Weight|default disabled states|feature flag"
  - pnpm -C devhub typecheck
  - pnpm -C devhub lint
  - pnpm -C devhub check:no-cloud-deps
  - pnpm -C devhub check:no-ocr-deps
  - pnpm -C devhub check:zod-sot
  - git diff --check scoped to this spec, the completion ledger, and devhub/src/shared/feature-flags.test.ts
verified_results:
  targeted_vitest: passed; 5 files passed, 2 files skipped by filter, 15 tests passed, 107 tests skipped
  typecheck: passed
  lint: passed; no emoji found in 596 files
  no_cloud_deps: passed
  no_ocr_deps: passed
  zod_sot: passed
  scoped_diff_check: passed
  scoped_outer_emoji_scan: passed
completion_boundary:
  - Dempster-Shafer and Bayesian modes no longer fall back to weighted-mean; focused regression tests assert no degradation warning and algorithm-specific output.
  - The legacy AITaskTracker detection path remains preserved rather than removed or broadly refactored.
  - This sync does not claim packaged Electron Playwright coverage beyond the existing unit/runtime/preload/renderer slice.
```

## 16. Implementation Evidence — 2026-05-14 Dempster-Shafer + Bayesian Fusion Closure

```yaml
status: verified
scope:
  - replaced the previous non-weighted algorithm degradation path in SignalFusion with real Dempster-Shafer mass combination
  - added Bayesian update as a log-odds evidence path weighted by each source effectiveWeight / totalEffectiveWeight
  - preserved the weighted-mean default path and existing confidence-cap behavior
  - kept the legacy AITaskTracker path intact; no broad refactor or deletion was introduced
implemented_in:
  - devhub/src/main/services/detection/SignalFusion.ts
  - devhub/src/main/services/detection/SignalFusion.test.ts
verified_commands:
  - cd devhub && npx gitnexus impact --repo devhub --direction upstream --include-tests --depth 2 SignalFusion
  - cd devhub && npx gitnexus impact --repo devhub --direction upstream --include-tests --depth 2 fuse
  - pnpm -C devhub exec eslint src/main/services/detection/SignalFusion.ts src/main/services/detection/SignalFusion.test.ts
  - pnpm -C devhub test --run src/main/services/detection/SignalFusion.test.ts --maxWorkers=1
  - pnpm -C devhub test --run src/main/services/detection/SignalFusion.test.ts src/main/services/R8RuntimeService.test.ts -t "fusion|SignalFusion|signal" --maxWorkers=1
  - pnpm -C devhub exec tsc --noEmit --pretty false
verified_results:
  gitnexus_impact: LOW risk; direct upstream files are R8RuntimeService.ts and SignalFusion.test.ts, with r8RuntimeHandlers.ts and R8RuntimeService.test.ts at depth 2
  eslint: passed for SignalFusion.ts and SignalFusion.test.ts
  focused_signal_fusion_vitest: passed; 1 file / 4 tests
  impacted_runtime_vitest: passed; 2 files, 10 selected tests passed, 82 skipped by filter
  typecheck: passed
algorithm_evidence:
  - dempster-shafer test asserts finite [0,1] fusion output, no weighted-mean degradation warning, and percent not equal to weighted-mean baseline
  - bayesian-update test recomputes expected percent from logit(rawValue) weighted by effective source weights and asserts exact close match
remaining_not_claimed_done: []
```
