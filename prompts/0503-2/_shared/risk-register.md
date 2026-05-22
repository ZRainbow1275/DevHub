# R8 风险登记表（risk-register.md）

> **生成时间**: 2026-05-03
> **数据源**: 4 PRD risk_register（10 R8.A + 12 R8.B + 20 R8.C = 42 RISK）+ 67 spec §12 fallback_strategy 整合
> **范围**: 71 文件全量
> **目标**: 单一来源说明 R8 整批"哪些风险、概率/影响多大、缓解方案、触发条件、责任 spec"，CI/release-manager/oncall 直接消费
> **签名**: ZRainbow 2026-05-03

> **当前状态（2026-05-14）**: 本文件的 2026-05-03 风险全集保留为历史风险基线；当前 release/no-go 判断以本附录、completion ledger、以及本地验证命令为准。原文中的 71 文件范围是历史计划口径，当前 filesystem truth 为 `prompts/0503-2` 下 81 个 Markdown 文件。

## §-1 当前风险附录（2026-05-14）

```yaml
current_risk_register_status:
  prompt_markdown_files: 81
  ledger: .trellis/tasks/05-05-r8-0503-2-full-completion-ledger/research/0503-2-completion-ledger.md
  verified_runtime_guards:
  - check:no-cloud-deps
  - check:no-ocr-deps
  - check:zod-sot
  - focused_schema_ipc_preload_vitest
  - typescript_no_emit
  - check:no-emoji
  historical_sections_below: retained_for_baseline_risk_taxonomy

current_p0_no_go_boundaries:
  no_fake_completion:
  status: active
  trigger: any spec row marked verified without code_or_test_or_script_or_doc evidence
  no_mock_runtime_claims:
  status: active
  trigger: contract_only_fallback_or_preview_helper_used_as_executable_feature
  no_dependency_violation:
  status: guarded
  trigger: cloud_sync_or_ocr_dependency_added_in_R8
  no_registry_drift:
  status: guarded
  trigger: R8_IPC_CHANNELS channel missing concrete_owner_or_contract_only_fallback
```

### §-1.1 当前新增或降级后的重点风险

| id | 当前状态 | 触发条件 | 缓解/证据 |
|---|---|---|---|
| R8-SHARED-IPC-REGISTRY-DRIFT | mitigated | `R8_IPC_CHANNELS` 新增 channel 后 main-process owner 未注册 | 2026-05-14 `r8RuntimeHandlers.test.ts` 通过 owner split coverage 断言 missing/duplicate 均为空。 |
| R8C-SIGNAL-FUSION-DEGRADE | mitigated | Dempster-Shafer / Bayesian 算法被 silent degrade 到 weighted mean | 2026-05-14 `SignalFusion.test.ts` 覆盖 mass combination 与 log-odds evidence，断言不等于 weighted baseline。 |
| R8C-CSV-PYTHON-CONTROL-DRIFT | mitigated | Python CSV runner 只能启动，不能通过真实长驻 control pipe pause/resume | 2026-05-14 真实 Python named-pipe control ACK 测试与 SHA256 校验已通过。 |
| R8C-CODEX-SHIM-PACKAGED-EXE | closed | 2026-05-16 已通过 `@yao-pkg/pkg` 生成 Windows x64 / Linux x64 / macOS x64 Codex shim executable；Windows x64 已真实执行并验证 stdout/stderr/named-pipe frame。 | 保留 build/verify 脚本和 SHA256 产物生成流程；不将 Claude/Gemini packaged exe 或 macOS/Linux 执行证明并入本项。 |
| R8B-I18N-HARDCODED-STRINGS | open | renderer 硬编码中文未全量迁移到 `t('key')` | 保持 R8.B spec-15 partial，后续需全量迁移和 `i18n:check` 证据。 |
| R8B-A11Y-FULL-AUDIT | open | 尚未完成全 renderer ARIA/keyboard audit | 保持 R8.B spec-16 partial；已有 axe smoke 不替代全量审计。 |

---

## §0 文档地位与读法

```yaml
position: 跨 batch 的 SoT —— 任何 release-go/no-go、incident retro、紧急 hotfix 必须以本文为准
machine_actionable: yes
naming_convention:
  - PRD risk_id: R8X-RISK-N（X∈A/B/C，N=1..K）
  - spec fallback: <SPEC_ID>-FALLBACK-<scenario>  # 例：R8.C.spec-15-FALLBACK-on_better_queue_fail
scoring_model:
  probability:
  1: 极低（< 1%）
  2: 低（1-10%）
  3: 中（10-30%）
  4: 高（30-60%）
  5: 极高（> 60%）
  impact:
  1: 仅警告（无功能损失）
  2: 单 spec 局部降级
  3: 单 batch 部分失能
  4: 跨 batch 关键路径中断
  5: 全局阻塞 release / 数据丢失 / 隐私泄露
  risk_score: probability × impact (1-25)
  tiers:
  P0: score ≥ 16 → 必须缓解 + 监控告警 + 演练
  P1: 9 ≤ score ≤ 15 → 必须缓解 + 文档化触发
  P2: 4 ≤ score ≤ 8  → 接受 + fallback 自动生效
  P3: score ≤ 3  → 接受 + 仅记录

read_priorities:
  release_manager: §1 P0 + §6 release_gate_blockers
  oncall: §1 P0/P1 + §3 触发条件
  qa: §2 全部 + §5 演练计划
  dev: §1 自己 spec 名下的 RISK
```

---

## §1 风险全集（按优先级 + 风险打分排序）

> 共 42 PRD RISK + 28 高价值 spec FALLBACK = 70 项；按 score 降序排列。表头：ID / 描述 / 概率 / 影响 / 分数 / 优先级 / 责任 spec。

### §1.1 P0 优先级（score ≥ 16，5 项）

| # | id | 描述 | P | I | score | spec |
|---|---|---|---|---|---|---|
| 1 | R8C-RISK-6 | Watchdog 自身崩溃，4-6 实例 24h 长跑期间监控失效 | 4 | 5 | 20 | R8.C.spec-17 |
| 2 | R8C-RISK-14 | Watchdog 重启注入引发死循环（任务永远卡死 + 系统资源爆） | 4 | 5 | 20 | R8.C.spec-16 |
| 3 | R8C-RISK-17 | 诊断包脱敏不完整（API key / token 泄漏） | 3 | 5 | 15 + 隐私敏感 → P0 | R8.C.spec-36 |
| 4 | R8C-RISK-18 | OCR 接口被误调用导致依赖泄漏（违反 V1-Q-10.B.5 不实现 OCR） | 3 | 5 | 15 + 强约束 → P0 | R8.C.spec-39 |
| 5 | R8A-RISK-7 | 审计面板暴露过多敏感操作目标（审计日志含 prompt/token） | 4 | 4 | 16 | R8.A.spec-10 |

### §1.2 P1 优先级（9 ≤ score ≤ 15，18 项）

| # | id | 描述 | P | I | score | spec |
|---|---|---|---|---|---|---|
| 6  | R8C-RISK-1  | Codex 无 stable JSON 输出 | 4 | 3 | 12 | R8.C.spec-02 |
| 7  | R8C-RISK-3  | Gemini stdout pattern 不稳定 | 4 | 3 | 12 | R8.C.spec-04 |
| 8  | R8C-RISK-4  | Cursor / Copilot 无 CLI，仅窗口标题感测 | 4 | 3 | 12 | R8.C.spec-05 |
| 9  | R8C-RISK-7  | inject SendInput 在游戏窗口 / Citrix 失败 | 4 | 3 | 12 | R8.C.spec-18 |
| 10 | R8C-RISK-10 | 全屏拓扑 500+ 节点卡顿（feedback#5 主路径） | 4 | 3 | 12 | R8.C.spec-24 |
| 11 | R8C-RISK-15 | 录像磁盘占用爆炸（24h 长跑 + 全 5 stream） | 4 | 3 | 12 | R8.C.spec-22 |
| 12 | R8B-RISK-3  | spec-06 d3-hierarchy treemap 渲染卡（>500 进程） | 3 | 4 | 12 | R8.B.spec-06 |
| 13 | R8B-RISK-4  | spec-07 用户上传 SVG 含恶意 script（XSS） | 3 | 4 | 12 | R8.B.spec-07 |
| 14 | R8B-RISK-8  | spec-12 进程批量误杀（多 PID 选中后批量 kill） | 3 | 4 | 12 | R8.B.spec-12 |
| 15 | R8C-RISK-2  | Claude --output-format=stream-json 版本变更 | 3 | 4 | 12 | R8.C.spec-03 |
| 16 | R8C-RISK-9  | better-queue SQLite 文件损坏 | 3 | 4 | 12 | R8.C.spec-15 |
| 17 | R8A-RISK-1  | wmi-client 在某些 Windows 版本失败 | 4 | 3 | 12 | R8.A.spec-01 |
| 18 | R8A-RISK-3  | 用户 24h UAC 记忆按 EXE+字段类别 hash 误命中 | 3 | 4 | 12 | R8.A.spec-03 |
| 19 | R8A-RISK-5  | 主题 view-transition Electron 28 兼容性 | 3 | 3 | 9  | R8.A.spec-06 |
| 20 | R8A-RISK-9  | always-on-top 在多屏 / 全屏游戏场景失败 | 3 | 3 | 9  | R8.A.spec-08 |
| 21 | R8C-RISK-13 | 三层状态机层间断言违反（feedback#4 误报） | 3 | 4 | 12 | R8.C.spec-28 |
| 22 | R8C-RISK-19 | DAG 编辑器（spec-21）误改导致并发冲突 | 3 | 3 | 9  | R8.C.spec-21 |
| 23 | R8C-RISK-20 | 监控窗口 popout（spec-08）IPC 桥接断连 | 3 | 3 | 9  | R8.C.spec-08 |

### §1.3 P2 优先级（4 ≤ score ≤ 8，14 项）

| # | id | 描述 | P | I | score | spec |
|---|---|---|---|---|---|---|
| 24 | R8C-RISK-5  | SHIM PATH 注入失败（用户 PATH 已满） | 2 | 3 | 6 | R8.C.spec-02..04 |
| 25 | R8C-RISK-8  | DAG cycle 检测后用户改了 CSV 又触发 | 2 | 3 | 6 | R8.C.spec-20 |
| 26 | R8C-RISK-11 | 流程图 30min 数据量爆炸 | 2 | 3 | 6 | R8.C.spec-26 |
| 27 | R8C-RISK-12 | 通知聚合 key 冲突导致漏报 | 2 | 3 | 6 | R8.C.spec-30 |
| 28 | R8C-RISK-16 | Zod schema 大规模改动破坏旧数据 | 2 | 4 | 8 | R8.C.spec-33 |
| 29 | R8B-RISK-1  | spec-02 BrowserWindow 跨屏失败（多 DPI） | 2 | 3 | 6 | R8.B.spec-02 |
| 30 | R8B-RISK-2  | spec-04 cmdk 性能低于 P99 16ms | 3 | 2 | 6 | R8.B.spec-04 |
| 31 | R8B-RISK-5  | spec-09 节点 > 200 时 thumbnail 卡 | 2 | 3 | 6 | R8.B.spec-09 |
| 32 | R8B-RISK-6  | spec-15 i18next 与现有 hardcoded 中文冲突 | 2 | 2 | 4 | R8.B.spec-15 |
| 33 | R8B-RISK-9  | spec-13 黑名单存储被恶意端口程序篡改 | 2 | 3 | 6 | R8.B.spec-13 |
| 34 | R8B-RISK-10 | spec-17 4 套图标累计 bundle 超 8MB | 2 | 3 | 6 | R8.B.spec-17 |
| 35 | R8B-RISK-11 | spec-04 命令面板 9 项搜索结果分组紊乱 | 2 | 2 | 4 | R8.B.spec-04 |
| 36 | R8B-RISK-12 | spec-11 Win11 24H2 虚拟桌面 API 变更 | 2 | 3 | 6 | R8.B.spec-11 |
| 37 | R8B-RISK-7  | spec-01 拖拽触发与系统拖拽冲突 | 2 | 2 | 4 | R8.B.spec-01 |

### §1.4 P3 优先级（score ≤ 3，5 项）

| # | id | 描述 | P | I | score | spec |
|---|---|---|---|---|---|---|
| 38 | R8A-RISK-2 | sudo-prompt 等替代 UAC 库的 license（必须 MIT/ISC/BSD） | 1 | 3 | 3 | R8.A.spec-01 |
| 39 | R8A-RISK-4 | nut.js 在 Win11 24H2 表现 | 2 | 1 | 2 | R8.A.spec-01 |
| 40 | R8A-RISK-6 | 4 套图标库累计 bundle 体积超 8MB | 2 | 1 | 2 | R8.A.spec-01 + spec-17 |
| 41 | R8A-RISK-8 | spec-05 入口贯通可能与 R8.C spec-24/25 冲突 | 1 | 2 | 2 | R8.A.spec-05 |
| 42 | R8A-RISK-10 | UAC 提权后 spawn 子进程的 IPC pipe 失败 | 1 | 3 | 3 | R8.A.spec-03 |

---

## §2 P0 详细缓解方案（5 项）

### §2.1 R8C-RISK-6 — Watchdog 自身崩溃

```yaml
description: 4-6 个 Claude/Codex/Gemini 实例 24h 长跑场景下，InnerWatchdog 子进程崩溃 → AI 任务监控失效 → 用户丢任务
probability: 4 / impact: 5 / score: 20
trigger_conditions:
  - InnerWatchdog 进程 crash（OOM / unhandled rejection / native module 段错误）
  - 三通道（named pipe / TCP / marker file）全部失联 ≥ 30s
  - InnerWatchdog 反向 ping 主进程 ≥ 3 次失败
mitigations:
  primary:
  - spec-17 双层守望：DevHub 主进程作为 OuterWatchdog，监控 InnerWatchdog 心跳
  - 三通道冗余通信（named pipe 主 / TCP fallback / marker file 最低）
  - mutual heartbeat 5s 间隔，3 次失败 → respawn
  - respawn 风暴防护：max=5/hour，指数退避 1s/2s/4s/8s/16s
  secondary:
  - 用户主动启用 Windows Service 第三层（OuterOuterWatchdog）
  - sessionToken 跨进程持久化，DevHub 重启后接管已存在 InnerWatchdog
  tertiary:
  - 最终极降级：spec-17 R8.C.watchdog.subprocess=OFF → spec-16 引擎在主进程内运行（接受功能下降）
detection:
  - watchdog-supervisor:status IPC 每 30s 自检
  - 全部三通道断 → emit watchdog:event-stream 'storm-detected'
  - audit log 记录 spawn-attempt
recovery_runbook:
  step_1: 检查 %APPDATA%/devhub/watchdog-token.dat 是否存在
  step_2: pnpm devhub watchdog --diagnose（独立诊断子命令）
  step_3: 若 spawn 5 次失败 → 通知用户 FATAL + feature flag 临时关闭
  step_4: 用户重启 DevHub + 检查日志 logs/watchdog-*.log
drill: monthly
owner: R8.C.spec-17 + R8.C.spec-34（崩溃恢复协同）
```

### §2.2 R8C-RISK-14 — Watchdog 重启注入死循环

```yaml
description: AI 实例反复崩溃 → Watchdog 反复重启 + 注入 → 任务永远卡死 / 系统资源 100% 占用
probability: 4 / impact: 5 / score: 20
trigger_conditions:
  - 同一 instanceId 在 1 小时内 stuck → restart → resume-inject → 仍 stuck 循环
  - consecutiveStuckCount ≥ 3
  - 注入文本立即触发 AI 输出 error → Watchdog 再次判 stuck
mitigations:
  primary:
  - spec-16 RestartGovernor: maxRestartsPerHour=5，超限 → reject restart
  - consecutiveStuckCount ≥ 3 → actionPolicy 切换到 fallback-tool / human-intervention
  - storm-detected 事件触发 spec-30 通知 ERROR + 暂停该 instance 监控
  secondary:
  - 用户可手动 watchdog:override-restart action='pause-watchdog' 暂停该实例
  - inject 失败 → InjectFailureKind 记录，不无限重试
  tertiary:
  - feature flag R8.C.watchdog.engine=OFF → 退回 R7 SystemProcessScanner（功能下降）
detection:
  - spec-16 storm-detected event
  - spec-29 反馈循环消费 storm 事件 → 误报分类 'cascading-restart'
  - audit log 记录每次 restart 时间戳
recovery_runbook:
  step_1: watchdog:override-restart action='force-fallback' instanceId=X
  step_2: 检查 logs/watchdog-{instanceId}.log 找根因（OOM / config 错误）
  step_3: 修正 prompt / config 后 watchdog:override-restart action='resume-watchdog'
drill: quarterly
owner: R8.C.spec-16 + spec-29（反馈循环）+ spec-30（通知）
```

### §2.3 R8C-RISK-17 — 诊断包脱敏不完整（隐私泄漏）

```yaml
description: 用户主动导出诊断包（spec-36）时脱敏不完整，API key / OAuth token / OPENAI_API_KEY 等敏感字段泄漏到 ZIP 文件 → 用户分享后被滥用
probability: 3 / impact: 5 / score: 15（隐私敏感 → P0）
trigger_conditions:
  - 用户在 stdout/stdin 中输入了未识别格式的 secret
  - REDACT_PATTERNS 未覆盖新 token 格式（如 google API key 不同 prefix）
  - 录像（spec-22）中包含 git commit 含 secret
mitigations:
  primary:
  - spec-22 Redactor REDACT_PATTERNS：OPENAI_API_KEY / ANTHROPIC_API_KEY / password / token / 通用 40+ hex
  - spec-36 导出前必须用户预览（强约束）
  - 用户可逐项勾选/取消
  - 用户主动 opt-in（绝不自动收集）
  secondary:
  - 第二轮扫描：导出后再用 secretlint 工具扫描 ZIP 内容，命中 secret → 强制重做
  - audit log 记录脱敏 pattern 命中数
  - 用户可在设置中扩展 REDACT_PATTERNS
  tertiary:
  - 默认拒绝包含录像（用户主动开启）
detection:
  - spec-36 dry-run 阶段统计 redacted_count
  - CI 静态扫描 fixtures/ 目录禁止 sk-/AKIA/ghp_ 等 prefix
  - secretlint pre-commit hook
recovery_runbook:
  step_1: 用户报告泄漏 → 立即 revoke 该 secret（ChatGPT/Anthropic dashboard）
  step_2: 检查 audit log 找时间窗
  step_3: 更新 REDACT_PATTERNS + 发热修复（feature flag 推送）
  step_4: RCA 报告写到 docs/incidents/
drill: quarterly + 每次 REDACT_PATTERNS 变更
owner: R8.C.spec-36 + spec-22 + master §6 PRIVACY-ZERO-TELEMETRY
```

### §2.4 R8C-RISK-18 — OCR 接口被误调用（依赖泄漏）

```yaml
description: spec-39 设计为占位（V1-Q-10.B.5 答 A 不实现 OCR），但开发者误调用导致 tesseract / paddle / cloud-ocr 依赖被引入 → 违反用户强约束 + 隐私风险
probability: 3 / impact: 5 / score: 15（强约束 → P0）
trigger_conditions:
  - 任意 spec 代码 import tesseract.js / @paddle-ocr / google-cloud-vision 等
  - OCR 接口被实际调用（非返回 E_OCR_DISABLED）
mitigations:
  primary:
  - spec-39 接口必返回 E_OCR_DISABLED（hardcoded）
  - CI grep 静态检查：禁止 import tesseract.js / paddle / google-cloud-vision / aws-textract / azure-cognitive
  - master §6 NO-OCR-INTEGRATION 列入 hard_constraints
  secondary:
  - PR review 手动检查（dependabot 拒绝 OCR 类 deps）
  - package.json 依赖审计 nightly
  tertiary:
  - 若发生违规：feature flag 紧急关闭 + 撤包
detection:
  - CI scripts/ci/grep-banned-deps.sh
  - nightly: pnpm why tesseract / pnpm why @paddle-* 必返回 not found
  - audit log 记录 OCR 接口调用
recovery_runbook:
  step_1: PR 阶段拒绝（CI BLOCK_MERGE）
  step_2: 已合入 → 紧急 revert + 通知用户
  step_3: RCA 报告
drill: 每次依赖审计
owner: R8.C.spec-39 + CI grep-banned-deps（待新增到 ci 流程）
```

### §2.5 R8A-RISK-7 — 审计面板暴露敏感操作目标

```yaml
description: R8.A spec-10 audit log 完整记录所有 mutation；面板查看时若不脱敏 → API key / target hwnd / inject text 全文暴露
probability: 4 / impact: 4 / score: 16
trigger_conditions:
  - 用户在 inject 文本中含 secret
  - audit 查询包含完整 inject text
  - 截图 / 屏幕共享时面板可见
mitigations:
  primary:
  - spec-10 REDACT_PATTERNS 内容字段实时脱敏（API_KEY/TOKEN/PASSWORD）
  - 默认折叠展示 + 用户主动 click "show full"
  - V1-Q-9.C.4 答 C 关键字过滤
  secondary:
  - 用户 click "show full" 走 R8.A spec-11 dangerous action 二次确认 + 输入 'yes'
  - 全屏共享检测 → 自动模糊面板
  tertiary:
  - 可选 AES-256-GCM 加密本地审计文件（spec-10）
detection:
  - 面板每条 entry 自动 highlight 命中 REDACT_PATTERNS 的位置
  - audit log 元数据记录 redaction_count
recovery_runbook:
  step_1: 用户报告 → 检查具体字段
  step_2: 扩展 REDACT_PATTERNS
  step_3: 提示用户在 inject text 中避免 inline secret
drill: bi-monthly
owner: R8.A.spec-10 + R8.C.spec-22（recording 同 pattern）
```

---

## §3 触发条件汇总（按 spec 索引）

> 用于 oncall 快速定位"看到什么现象 → 哪条 RISK 触发了"。

```yaml
trigger_signals:
  spec_01_cli_parser:
  - "parse_lines_per_sec < 200/sec for 60s" → R8C-RISK-1/2/3 (NDJSON pattern 异常)
  spec_02_03_04_shim:
  - "shim:install fail" → R8C-RISK-5 (PATH 注入失败)
  - "Codex stdout 非 JSON for 5min" → R8C-RISK-1
  - "Claude --output-format=stream-json field missing" → R8C-RISK-2
  - "Gemini stdout 无识别 token for 5min" → R8C-RISK-3
  spec_05_cursor_copilot:
  - "chokidar miss + window-title unchanged for 10min" → R8C-RISK-4
  spec_15_task_queue:
  - "PRAGMA integrity_check fail" → R8C-RISK-9
  - "task stuck > timeout" → 检查 spec-16 联动
  spec_16_watchdog:
  - "consecutiveStuckCount ≥ 3 同一 instance" → R8C-RISK-14
  - "restartCount > 5/hour" → R8C-RISK-14 storm
  spec_17_watchdog_subprocess:
  - "InnerWatchdog 三通道全断 ≥ 30s" → R8C-RISK-6
  - "spawn fail 5 次连续" → R8C-RISK-6 escalate
  spec_18_inject:
  - "InjectFailureKind ∈ ['ignored','encoding-error','wrong-position']" → R8C-RISK-7
  - "SendInput in protected window" → R8C-RISK-7（Citrix/游戏）
  spec_20_dag:
  - "csv:save 时 hasCycle=true" → R8C-RISK-8
  spec_21_dag_editor:
  - "lockfile conflict 或 mtime mismatch" → R8C-RISK-19
  spec_22_recording:
  - "totalBytesOnDisk > 50GB" → R8C-RISK-15
  - "single task > 1GB" → R8C-RISK-15 rotate
  spec_24_topology_global:
  - "node count > 500 + 用户主动 expand" → R8C-RISK-10
  spec_25_topology_attached:
  - "depth=10 + 节点累计 > 500" → R8C-RISK-10
  spec_26_flow:
  - "windowMs=24h + events > 500" → R8C-RISK-11
  spec_28_state_machine:
  - "system_layer='active' AND task_layer='idle' for any duration" → R8C-RISK-13（feedback#4）
  spec_30_notification:
  - "aggregationKey collision 检测到" → R8C-RISK-12
  spec_33_zod:
  - "schema migration 失败 / 旧数据校验 fail" → R8C-RISK-16
  spec_36_diagnostic:
  - "redaction_count = 0 但 stdin 含可识别 secret pattern" → R8C-RISK-17
  spec_39_ocr:
  - "import tesseract / paddle / google-cloud-vision 检测到" → R8C-RISK-18

  spec_R8A_01:
  - "wmi-client 调用 rejected on Windows < 10.0.19041" → R8A-RISK-1
  - "license-checker 拒绝某 lib" → R8A-RISK-2
  - "renderer bundle delta > 8MB" → R8A-RISK-6
  spec_R8A_03:
  - "UAC cache hit 但 exe_path 已变（exe 替换）" → R8A-RISK-3
  - "elevated worker IPC pipe 断" → R8A-RISK-10
  spec_R8A_06:
  - "view-transition unsupported on Electron < 30" → R8A-RISK-5
  spec_R8A_08:
  - "TOPMOST 在多屏 / 全屏游戏 失效" → R8A-RISK-9
  spec_R8A_10:
  - "audit panel show full 未走二次确认" → R8A-RISK-7

  spec_R8B_02:
  - "BrowserWindow.setBounds 在第二屏失败" → R8B-RISK-1
  spec_R8B_04:
  - "cmdk first result > 16ms p99" → R8B-RISK-2
  - "9 项搜索结果顺序紊乱" → R8B-RISK-11
  spec_R8B_06:
  - "treemap 渲染 > 1500ms（master §7.4 nodes_gt_500）" → R8B-RISK-3
  spec_R8B_07:
  - "用户上传 SVG 含 <script>" → R8B-RISK-4
  spec_R8B_09:
  - "thumbnail wall > 200 节点 FPS < 30" → R8B-RISK-5
  spec_R8B_11:
  - "IVirtualDesktopManager 接口不可用" → R8B-RISK-12
  spec_R8B_12:
  - "批量选中 ≥ 5 PID 跳过二次确认" → R8B-RISK-8
  spec_R8B_13:
  - "黑名单 electron-store 文件外部修改" → R8B-RISK-9
  spec_R8B_15:
  - "i18n 与 hardcoded 中文同时显示" → R8B-RISK-6
  spec_R8B_17:
  - "icon 总 bundle > 8MB" → R8B-RISK-10
```

---

## §4 缓解方案矩阵（fallback 整合）

> 每 spec §12 fallback_strategy 抽象为统一的 4 层降级模型。

```yaml
fallback_layers:
  layer_1_primary_protection:
  description: spec 内置的主动防护（feature flag ON 时自动生效）
  examples:
  - spec-15 PRAGMA integrity_check 启动时自动检测 SQLite
  - spec-16 RestartGovernor maxRestartsPerHour=5
  - spec-17 三通道冗余通信
  - spec-22 LRU 50GB + 单任务 1GB rotate
  - spec-30 aggregationKey = sha256(level + source + instanceId)
  - spec-36 用户预览 + 强制 opt-in

  layer_2_graceful_degradation:
  description: 单源失败时自动切换到 fallback 数据源
  examples:
  - spec-01 NdjsonStrategy 失败 → LineBasedStrategy（→ SHIM stdout pattern）
  - spec-02..04 SHIM 不可用 → line-based 解析（feedback#4 不阻断）
  - spec-15 better-queue → p-queue（仅内存）
  - spec-16 Marker 文件 fail → CPU+stdout 双信号
  - spec-17 named pipe → TCP localhost → marker file
  - spec-18 uia → clipboard-paste → sendinput（mode fallback 链）
  - spec-22 chokidar 失败 → 仅 stdout/stdin 流
  - spec-24 节点 > 500 → 自适应降级 + 用户主动 expand
  - spec-25 depth=10 lazy 模式
  - R8.A.spec-01 wmi-client → PowerShell gateway
  - R8.B.spec-06 treemap → list view
  - R8.B.spec-11 IVirtualDesktopManager → 仅当前桌面

  layer_3_feature_flag_off:
  description: 整 spec 关闭，退回到上一批次行为（master §6 R7-NO-DELETE 保证）
  examples:
  - R8.C.watchdog.engine=OFF → 退回 R7 SystemProcessScanner 定时扫描
  - R8.C.csv.launch=OFF → 仅 CLI 命令行触发
  - R8.C.topology.global=OFF → 一级入口隐藏，仅附属图（spec-25）可用
  - R8.C.recording.engine=OFF → 仅最简 stdout NDJSON 写 audit
  - R8.C.inject.engine=OFF → 退回 R7 SEND_KEYS 按键模式
  - R8.B.command.palette=OFF → 仅顶栏菜单
  - R8.A.theme.4d-axis=OFF → 仅 palette，其他 3 轴 hardcode

  layer_4_user_intervention:
  description: 自动机制全失效后，用户必须手动接管
  examples:
  - spec-16 storm → human-intervention actionPolicy
  - spec-19 强制 opt-in 白名单 + 严格模式
  - spec-21 lock conflict → 强制接管 + 二次确认
  - spec-34 崩溃后启动检测 dirty state → 用户选择恢复策略
  - spec-39 OCR 误调用 → 紧急 revert
```

---

## §5 风险演练计划（drill schedule）

```yaml
drill_calendar:
  weekly:
  - target: 24h long-run baseline（master §7.4 long_run_baseline_hours=24）
  - covers: P0 #1 #2（Watchdog 系列）
  - owner: oncall

  monthly:
  - target: kill InnerWatchdog 模拟（spec-17 GWT-2）
  - covers: R8C-RISK-6
  - target: cascading restart storm 模拟
  - covers: R8C-RISK-14
  - target: SQLite 损坏后启动恢复（spec-15 + spec-34）
  - covers: R8C-RISK-9 / R8C-RISK-16

  quarterly:
  - target: 诊断包脱敏审计（用 secretlint 扫近 1 季度所有导出）
  - covers: R8C-RISK-17
  - target: OCR 依赖审计（pnpm why + grep-banned-deps）
  - covers: R8C-RISK-18
  - target: privacy zero telemetry 端到端抓包（30min full session）
  - covers: ASSERT_NO_TELEMETRY + R8.A 审计

  on_each_release:
  - target: 24 critical assertions full pass
  - target: long-run 24h pass
  - target: backup/restore 真实演练（spec-35）
  - target: emoji lint 0 命中

  bi_monthly:
  - target: 审计面板二次确认流程演练
  - covers: R8A-RISK-7

  on_dep_change:
  - target: license audit + bundle size + OCR 黑名单 grep
  - covers: R8A-RISK-2 / R8A-RISK-6 / R8C-RISK-18
```

---

## §6 Release Gate Blockers

```yaml
release_blockers:
  any_p0_unmitigated:
  - if: P0 (5 项) 缓解方案任一失效或 detection 不可用
  - action: BLOCK_RELEASE + RCA + 用户对话重新评审
  any_p1_score_15:
  - if: 5 项 score=15 中任一在 release-candidate 阶段触发
  - action: BLOCK_RELEASE 直到完成缓解
  privacy_telemetry_fail:
  - if: ASSERT_NO_TELEMETRY 抓包发现外部连接（非用户 CLI 自身 LLM API）
  - action: BLOCK_RELEASE + 紧急修复
  ocr_dep_detected:
  - if: package.json 含 tesseract / paddle / google-cloud-vision 等
  - action: BLOCK_RELEASE
  audit_log_redact_incomplete:
  - if: secretlint 在最近导出诊断包中命中
  - action: BLOCK_RELEASE + 扩展 REDACT_PATTERNS

release_warning_only:
  any_p2_active:
  - if: P2 (14 项) 任一在 stage-7 nightly 阶段触发
  - action: 通知 + 允许带病发布（feature flag 已 OFF）
  any_p3:
  - if: P3 (5 项) 触发
  - action: 仅文档化，不阻塞
```

---

## §7 残余风险（Residual Risks）

> 接受不缓解或缓解后仍存在的风险（必须文档化）。

```yaml
residual_risks:
  - id: RR-1
  description: 用户的 AI CLI（codex/claude/gemini）自身向 LLM API 发出连接（用户授权）
  rationale: 这是用户自己的 CLI 配置，DevHub 不阻止；ASSERT_NO_TELEMETRY 仅约束 DevHub 自身
  monitoring: 区分 DevHub 进程 vs 用户 CLI 进程的网络连接

  - id: RR-2
  description: 用户主动启用 Windows Service 第三层 watchdog → 系统级权限风险
  rationale: 用户 opt-in，安装时走 spec-03 单次 UAC；卸载也需管理员
  monitoring: audit log 记录 install/uninstall

  - id: RR-3
  description: 用户主动启用诊断包导出含录像 → 截图可能含敏感屏幕内容
  rationale: 用户 opt-in + 预览 + 强制脱敏；不能阻止用户主动导出
  monitoring: spec-36 dry-run 显示截图缩略图供用户检查

  - id: RR-4
  description: cytoscape 大图 (>2000 节点 expand) 性能不可控
  rationale: 用户主动 expand 时已警告；超 2000 仍可能卡
  monitoring: 自动降级到 grid layout + FPS < 15 时提示用户

  - id: RR-5
  description: 跨进程 sessionToken 持久化（%APPDATA%/devhub/watchdog-token.dat）
  rationale: 文件 ACL 限定当前用户读；本机用户已可读所有文件，不构成新泄漏
  monitoring: 启动时检测文件权限非 user-only → 重新生成

  - id: RR-6
  description: chokidar 在大型 monorepo cwd 上的 CPU 占用
  rationale: 已 ignore node_modules / .git；用户自定义大型 cwd 仍可能高 CPU
  monitoring: 自动降级 awaitWriteFinish + 限速

  - id: RR-7
  description: better-queue SQLite 单文件 24h 长跑后体积增长
  rationale: 已含 LRU 淘汰（spec-22）；SQLite 自身 VACUUM 周期处理
  monitoring: 启动时检查文件大小 > 1GB → VACUUM

  - id: RR-8
  description: Watchdog Inner orphan 模式下不接受新 register-instance
  rationale: 主进程崩溃期间不能新注册实例；DevHub 重启后自动接管
  monitoring: orphan 状态写入 marker 文件供下次启动读取

acceptance_signature:
  signed_by: ZRainbow
  date: 2026-05-03
  next_review: 2026-08-03（季度复审）
```

---

## §8 用法对照表

```yaml
usage_for_release_manager:
  step_1: 检查 §6 release_gate_blockers 全过 → 否则 NO_GO
  step_2: 检查 §1.1 P0 演练记录 ≤ 1 月 → 否则补演练
  step_3: 检查 §5 weekly long-run 通过 → 否则等待
  step_4: GO + tag release

usage_for_oncall:
  step_1: 看到告警 → 查 §3 trigger_signals 定位 RISK ID
  step_2: 查 §2 (P0) 或 §1 (P1+) 详情 → 跑 recovery_runbook
  step_3: audit log 留痕 + RCA 写到 docs/incidents/

usage_for_pr_reviewer:
  step_1: PR 修改的文件 → 找 §1 spec 列对应 RISK
  step_2: 验 PR 是否破坏了 §4 fallback layers
  step_3: 验 §6 release_blockers 是否会被引入
```
