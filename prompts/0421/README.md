# Round 7 — DevHub v2 规格文档集 (2026-04-21)

> 本目录是 DevHub v2 的 R7 轮产出：**30 份企业级规格文档**，面向 R7 实现阶段（不含代码变更）。
> 源码根：`D:/Desktop/CREATOR ONE/devhub/`
> 诉求来源：`D:/Desktop/CREATOR ONE/prompts/0420/00-round6-overview.md`
> 作者：ZRainbow

---

## 10 分钟快速入门路径

如果你是**刚接手的 Agent / 工程师**，按以下顺序读：

1. `00-round7-overview.md`（必读，~6 分钟）— 全局目标、硬约束、最核心的 6 个结论
2. `00-acceptance-matrix.md`（必读，~2 分钟）— 29 条验收条目矩阵（用户 8 板块 + 横切）
3. `00-master-spec-plan.md`（速览，~2 分钟）— 30 份文档依赖图 + 批次安排

再按照你当前领取的 P 编号（如 `P2.1`）去读对应的 `spec/` 文档即可开工。

---

## 目录结构

```
0421/
├── 00-round7-overview.md          ← 全局总览
├── 00-master-spec-plan.md         ← 30 份文档的依赖图 + 批次
├── 00-acceptance-matrix.md        ← 29 条验收条目矩阵
├── README.md                      ← 本文件
│
├── rca/                           ← 根因分析（为什么 R5/R6 失败）
│   ├── 01-r5-archive-metadata-only.md
│   ├── 02-user-pain-map.md
│   └── 03-architecture-debt-ledger.md
│
├── spec/                          ← 20 份具体问题的规格
│   ├── 02-ia-topology-flow-attached-redesign.md      [P0-Design]
│   ├── 03-runtime-stability-architecture.md          [P0-Blocker]
│   ├── 04-scanner-lifecycle-contract.md              [P0-Blocker]
│   ├── 05-ipc-throttling-backpressure-spec.md        [P0-Blocker]
│   ├── 06-observability-dev-panel-spec.md            [P0-Blocker]
│   ├── 07-ai-window-alias-contract.md                [P0-Critical]
│   ├── 08-ai-task-detection-engine-spec.md           [P0-Critical]
│   ├── 09-window-groups-contract.md                  [P0-Critical]
│   ├── 10-window-layout-engine-spec.md               [P0-Critical]
│   ├── 11-ai-progress-tracker-contract.md            [P0-Critical]
│   ├── 12-window-operations-catalog.md               [P1]
│   ├── 13-project-card-dropdown-portal-fix.md        [P1]
│   ├── 14-process-detail-fallback-spec.md            [P1]
│   ├── 15-port-scroll-layout-timeout-spec.md         [P1]
│   ├── 16-window-layout-overflow-fix.md              [P1]
│   ├── 17-topology-rendering-fix.md                  [P1]
│   ├── 18-responsive-scaling-system.md               [P2]
│   ├── 19-theme-design-language-system.md            [P2]
│   ├── 20-ai-tool-icons-logo-system.md               [P2]
│   └── 21-project-ux-polish-roadmap.md               [P2]
│
├── contracts/                     ← 横切关注点
│   ├── 22-data-model-consistency-spec.md
│   ├── 23-ipc-contracts-master.md
│   ├── 24-permission-control-spec.md
│   └── 25-icon-library-inventory-no-emoji.md
│
├── references/                    ← 集成参考
│   └── 26-integration-library-inventory.md
│
├── tests/                         ← 测试计划
│   ├── 27-e2e-test-plan.md
│   └── 28-performance-benchmark-plan.md
│
└── playbooks/                     ← 发布 / 日常 playbook
    ├── 29-rollout-phasing-plan.md
    └── 30-r7-daily-verification-checklist.md
```

---

## 三条硬约束（每一份 spec 的第一段都会复述）

1. **不删功能** — 现有任何组件 / 模块 / 功能都不得删除，只能深化 / 替换 / 补齐 / 重挂载。现有"废弃"代码降级到 `legacy/` 子目录供回退。
2. **不用 Emoji** — 所有图标走已安装的 `lucide-react` + `src/renderer/components/icons/` + 新建 `brand-logos/`。项目源码 Emoji 码点清零。
3. **不做 Mock** — 所有 IPC / 存储 / 扫描行为对接真实 Win32 / 真实进程 / 真实 electron-store / 真实 React Flow。

---

## R7 的 "完成定义"

- [x] 30 份文档全部产出（见 `00-master-spec-plan.md` 清单）
- [x] 每份 spec 含 8 段：动机 / 受影响源码 / 数据契约 / IPC 契约 / 错误矩阵 / 验收条件 / E2E 脚本草案 / 参考实现
- [x] 交叉引用检查通过（见 `00-master-spec-plan.md` 第四节的表格）
- [x] `contracts/23-ipc-contracts-master.md` 列出的每一个 channel 都在至少一份 spec 里被引用
- [x] `tests/27-e2e-test-plan.md` 的每一条 E2E ID 都对应一份 spec 的"E2E 脚本草案"段
- [x] 本 README 被外部 Agent 在 10 分钟内可读懂

---

## 交付状态（2026-04-21）

| 项 | 数量 | 状态 |
|----|-----|------|
| 总文档数 | 30 | 已完成 |
| 总行数 | ~10,500 行 | - |
| Spec 文档 | 20（spec/02-21） | 已完成 |
| Contracts | 4（22-25） | 已完成 |
| References | 1（26） | 已完成 |
| Tests | 2（27-28） | 已完成 |
| Playbooks | 2（29-30） | 已完成 |
| RCA 文档 | 3（01-03） | 已完成 |
| Foundation 文档 | 3（00-overview / 00-plan / 00-matrix） | 已完成 |
| 交叉引用缺失数 | 0 | 全部 resolved |
| 装饰性 Emoji 数 | 0 | 仅 `spec/20` 与 `contracts/25` 的替换映射表中保留源 Emoji 作为"被替换标的"的说明用途 |
| 验收条目（E2E ID） | 136 | 覆盖 8 大板块 + 横切 X1-X8 |

**交付产物的使用路径**：

1. 从 `00-round7-overview.md` 理解 R7 的整体设计哲学
2. 按 `playbooks/29-rollout-phasing-plan.md` 的 Stage 顺序领取任务
3. 每个 Stage 对应若干份 spec；实现时严格按 spec 的"受影响源码"段锁定改动范围
4. 完成一个 stage 后，按 `playbooks/30-r7-daily-verification-checklist.md` 自查 + CI Gate
5. 阶段性交付以 `tests/27-e2e-test-plan.md` 的 suite 为通过门槛
6. 任何新增依赖先过 `references/26-integration-library-inventory.md` 审批
7. 任何新 IPC channel / 类型必须同步更新 `contracts/22-23-data-model + ipc`

---

## 本轮规格不覆盖的范围（明确 SCOPE 外）

- 新功能（非用户诉求衍生的功能）— 留待 R8 产品线
- DB schema 设计（DevHub v2 无 SQL DB）
- 移动端 / Web 端 / Linux / macOS 支持 — 本轮仅 Windows 11 x64
- 国际化 i18n 完整覆盖 — 本轮只补齐"查询超时"等关键报错文案
- 自动化更新 / 代码签名 — 留待发布工程专项

---

## 反馈 / 变更

R7 实现阶段发现 spec 有缺漏时：
1. 不要直接改代码绕过
2. 先在 `playbooks/30-r7-daily-verification-checklist.md` 的"Delta 日志"段记录发现
3. 更新对应 spec，在文档顶部写变更记录：`2026-04-XX (R7.N) 新增 XX 章节（原因：...）`
4. 然后回到实现

**没有契约就没有实现，只有错觉。**
