# R8 PRD/Spec 重写交付 — Codex CLI 接入说明

## 2026-05-21 implementation-continuation note

- Owner evidence submission intake is now hardened as a strict schema boundary in the active completion ledger: unknown owner-submission wrapper fields are rejected by `verify-0503-owner-evidence.mjs`, generated owner template README files tell evidence owners that unknown fields are rejected, `verify-0503-evidence-pack.mjs` locks that README guidance, and `.trellis/spec/backend/quality-guidelines.md` records the rule. The canonical `pnpm --silent check:0503-strict:vd-watch` run still exits `1` truthfully with `missingOrIncompleteRequirements=19`, `partialRows=5`, `missingEvidenceRows=0`, `failedExternalGateIds=6`, `surveyAcceptanceRows=3`, and `externalReportFresh=true`; the remaining blockers require real second-display hardware, physical monitor hotplug, Administrator shell, Windows Service installation, Administrator `pktmon` zero-egress capture, and legal/product license decision evidence.

**完成日期**: 2026-05-03
**完成者**: Claude (Opus 4.7) team `r8-rewrite-v2`（main + prd-writer + spec-r8a + spec-r8b）
**交付状态**: 100% 完成，可进入实施阶段
**总产出**: 80 文件 / ≈34,768 行 / emoji 0 / 8 维度审计 PASS

---

## 一、Codex CLI 接入起点

### 第一步（5 分钟）
读这两份就够上手：
1. `prompts/0503-2/00-r8-implementation-quickstart.md` — 实施期入口指南（385 行）
2. `prompts/0503-2/00-r8-master-prd.md` — Master PRD（1132 行，元约束 + 13 章节模板 + 全局契约）

### 第二步（按角色）
- **R8.A 实施**: 读 `R8.A/prd.md` + 11 spec
- **R8.B 实施**: 读 `R8.B/prd.md` + 17 spec
- **R8.C 实施**: 读 `R8.C/prd.md` + 39 spec
- **跨 spec 契约**: 读 `_shared/ipc-channels.md` / `zod-schemas.md` / `feature-flags.md`
- **测试**: 读 `_shared/testing-strategy.md`
- **风险**: 读 `_shared/risk-register.md`

---

## 二、5 大用户反馈 → 解决路径

| 反馈 | 用户原话 | 主要 spec | LoC 估算 |
|------|---------|----------|---------|
| #1.1 | 显示太不均匀，需多个收纳 | R8.B/spec-01/03/05 | ~2900 |
| #1.2 | 主题切换只换色 | R8.A/spec-06/07 + R8.B/spec-07 | ~4000 |
| #2.1 | 卡片/列表不一致 + 权限不足 | R8.A/spec-04 | ~600 |
| #2.2 | 拓扑/神经图入口三端贯通消失 | R8.A/spec-05 + R8.C/spec-24/25/26 | ~9850 |
| #3.1 | 端口卡太小 | R8.A/spec-09 + R8.B/spec-01/02 | ~5000 |
| #4.1 | AI 误报 | R8.C/spec-27/28/29 | ~3500 |
| #4.2 | 监控不准 | R8.C/spec-01..06 | ~10000 |
| #4.3 | 监控窗口/SKILLS/CSV/Watchdog/inject | R8.C/spec-07..19 | ~24500 |
| #5 | 拓扑双重存在（全局+附属） | R8.C/spec-24/25/26 | ~6100 |

完整追踪表：`_shared/feedback-traceability-matrix.md`

---

## 三、实施顺序（master PRD §2）

```
R8.A (急修+集成库+可见性, 2 周)
  ├─ 5 用户感知断言闸门
  └─ 通过 → R8.B + R8.C 并行启动

R8.B (收纳+体验, 3 周, 与 R8.C 并行)
R8.C (AI 编排核心, 6 周 / 6 波次)
```

**Wave 拓扑序**：见 `_shared/spec-dependency-graph.md` §7（7 level，机器可消费）

---

## 四、硬约束（违反即 PR 拒绝）

继承 R7：
1. NO-DELETE — 不允许删除现有功能
2. NO-EMOJI — 全部 UI/文档/日志禁用 emoji
3. NO-MOCK — 实现路径不允许 mock 数据

继承 R8：
4. NO-REFACTOR — 不允许大架构重构（IA 三栏不动）
5. REDUNDANCY-FIRST — 默认勾选所有可选项
6. INTEGRATE-FIRST — 自研白名单仅 4 项：
   - NeuralGraphEngine
   - AITaskTracker
   - WindowManager
   - ProcessUnifiedViewModel

新约束：
7. PRIVACY-ZERO-TELEMETRY — 不发任何遥测
8. TASKKILL-PER-PID — taskkill 仅单 PID
9. NO-API-KEY-UI — 不在 UI 暴露 API key 输入框
10. DUAL-GRAPH-MANDATORY — 三套图独立体系
11. GRAPH-DUAL-EXISTENCE — 全局 + 三端附属并存
12. THEME-AXIS-COORDINATION — 切 palette 强制联动 4 维
13. NO-OCR / NO-CLOUD-DEPS — spec-38/39 永久 disabled

CI 化强制：见 `_shared/testing-strategy.md` §6

---

## 五、交付清单（80 文件）

### PRD（5 份 / 3,862 行）
- `prompts/0503-2/00-r8-master-prd.md` (1,132)
- `prompts/0503-2/00-r8-implementation-quickstart.md` (385)
- `prompts/0503-2/R8.A/prd.md` (644)
- `prompts/0503-2/R8.B/prd.md` (724)
- `prompts/0503-2/R8.C/prd.md` (977)

### Spec（67 份 / 25,054 行）
- R8.A：11 spec / 4,974 行（process / topology / theme / window / port / audit / permission）
- R8.B：17 spec / 8,189 行（popout / drawer / cmdk / grid / treemap / decoration / window / i18n / a11y / icon）
- R8.C：39 spec / 11,891 行（CLI parser / SHIM / monitor / SKILL / CSV / watchdog / inject / DAG / topology / flow / signal fusion / observability）

### _shared（9 份 / 5,852 行）
- `audit-report.md` (544)
- `ipc-channels.md` (635) — 218 channel × 34 namespace
- `zod-schemas.md` (375) — Zod 单源索引
- `feature-flags.md` (651) — 85 flag
- `feedback-traceability-matrix.md` (519) — 5 大反馈追踪
- `spec-dependency-graph.md` (814) — 依赖 + 7 level 拓扑序
- `testing-strategy.md` (768) — 测试矩阵 + Playwright 草案
- `risk-register.md` (568) — 风险登记
- `glossary.md` (978) — 术语表

---

## 六、Spec 13 章节模板

每个 spec 严格 13 节：
1. motivation（含用户原话引用）
2. affected_source（文件:行号清单）
3. data_contracts（TypeScript + Zod）
4. ipc_contracts（channel + req/resp）
5. error_matrix（condition → error_code）
6. acceptance_gwt（≥ 5 Given/When/Then）
7. e2e_playwright_draft（Playwright 草案）
8. reference_impl（集成库 + 链接）
9. impact_radius_loc（影响半径 + 预计 LoC）
10. implement_checklist（实施 agent 检查项）
11. dependencies（与其他 spec 依赖）
12. fallback_strategy（失败 fallback）
13. performance_budget（ms / MB / FPS）

---

## 七、源码现状（refs/source-snapshot-v2.md 关键事实）

实施时需注意：
- WINDOW_SET_TOPMOST:424 已实现，UI 未暴露 → R8.A/spec-08 仅做 UI 暴露
- WINDOW_SEND_KEYS:463 仅支持键盘按键，**无文本注入** → R8.C/spec-18 必须走剪贴板路径
- AITaskTracker 当前 4 阶段启发式 + hardcoded 进度，**零 stdout 读取** → R8.C/spec-01..06 全重写
- TopologyView.tsx 已实现全局，但 ProcessDetailPanel:674-733 仅文字列表无图 → R8.A/spec-05 + R8.C/spec-24/25/26 补三端贯通
- AttachedGraphView 仅一套混合图 → R8.C/spec-25 拆为 network + neural + flow 三套
- Skill / Watchdog / SHIM / CSV runner 全部 0% 实现 → R8.C 大头

---

## 八、V1 + V2 沟通表（决策锚点源）

- V1（已填）：`prompts/0503/01-meta-vision-survey.md` 至 `11-roadmap-rollback-survey.md`，签名 ZRainbow 0503
- V2（未填，仅参考）：`prompts/0503/12-cross-module-jump-survey.md` 至 `28-final-acceptance-checklist.md`
- 引用格式：`V1-Q-X.Y.Z` / `V2-Q-X.Y.Z`
- 冲突规则：V1_WINS（除三套图体系，由 V2-§14 + 用户最新反馈共同强约束）

---

## 九、下一步（Codex CLI）

1. **进入 codex cli**
2. **首读** quickstart.md + master PRD（10 分钟）
3. **选批次** R8.A 优先（其 5 断言为 R8.B/C 闸门）
4. **按 wave 1 spec 实施**：建议从 R8.A/spec-01-integration-libs 开始（其他 spec 都依赖集成库就位）
5. **每 spec 完成**：跑 GWT 验收 + Playwright e2e + emoji-clean + ESLint 自定义规则
6. **PR commit message** 引用格式：见 quickstart.md §11

---

## 十、签字

**交付**: Claude Opus 4.7 (1M context) — team `r8-rewrite-v2`
**审阅**: ZRainbow（待审）
**质量门禁**: 8 维度 PASS（emoji 0 / 13 节齐全 / V1+V2 锚点合规 / 5 反馈完整映射 / 三套图体系 / 自研白名单 / master §7 一致 / 跨 spec 契约一致）
**实施 GO**: R8.A 立刻可启动；R8.B 等 R8.A 5 断言通过；R8.C 子模块可与 R8.B 并行

---

## 当前结论

目标仍未完成；不要调用 `update_goal complete`。

最新真实门禁命令：`pnpm --silent check:0503-strict:vd-watch`。

最新结果仍为非零退出，但 evidence pack 一致性通过。

推荐 VD watch 入口当前摘要：partialRows=5；missingEvidenceRows=0；failedExternalGateIds=6；surveyAcceptanceRows=3；externalReportFresh=true。

兼容普通 strict 入口当前摘要：partialRows=5；missingEvidenceRows=0；failedExternalGateIds=7；surveyAcceptanceRows=3；externalReportFresh=true。

## 当前剩余外部门禁

- `ASSERT_BROWSERWINDOW_SECOND_DISPLAY`
- `R8B_SPEC11_PHYSICAL_MONITOR_DISCONNECT_RECONNECT_READY`
- `R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY`
- `R8C_SPEC17_ADMIN_SHELL`
- `R8C_SPEC17_WINDOWS_SERVICE_INSTALLED`
- `H1_J16_ZERO_EGRESS_CAPTURE_READY`
- `R8_LICENSE_LEGAL_DECISION_RECORDED`

## 当前剩余 owner lanes

- `operator`：8
- `operator`：7
- `legal-product`：2
- `product`：1
- `user-product`：1

边界说明：普通 strict 未注入 foreground watch，因此会把 `R8B_SPEC11_TRUE_VD_SWITCH_EVENT_READY` 也列入待关闭门禁；推荐入口 `pnpm --silent check:0503-strict:vd-watch` 会在 Node runner 内注入该 opt-in，当前机器仍剩 6 个真实外部门禁。以上摘要只是当前机器证据索引，不是完成声明。
