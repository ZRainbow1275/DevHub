# DevHub R8 — 0503-V2 沟通表深化总览

> **本轮日期**: 2026-05-03（V2 续轮）
> **作者**: Claude (Opus 4.7) + ZRainbow（待审阅）
> **性质**: **沟通表深化轮（Survey Refinement Round）**，本轮**不写源码、不开 PRD、不开 Spec**
> **接续**: 上轮已产出 `00-overview.md` + `01-meta-vision-survey.md` 至 `11-roadmap-rollback-survey.md`（共 12 份），用户已基本填写完毕；后续 R8.A/B/C 三批 spec 已部分产出（位于 `prompts/0503-2/`）
> **本轮触发**: 用户在已填表 + 部分实现的基础上，再次反馈 5 大类**仍未解决**的问题（详见 §一）。本轮目标是**在原 13 份的维度之外**，再产出 17 份**深化沟通表**（编号 12-28），覆盖原表未触及的维度，提供可量化、可验收、可索引的更精细问题集，**为 PRD/Spec 第二次重写提供更高保真度的输入**。

---

## 一、本轮触发上下文（V2 用户痛点 5 大类）

用户在 2026-05-03（已填表 + 已写部分 spec 之后）再次反馈：

| # | 板块 | 用户原话 | 与已填 survey 的关系 | 本轮深化方向 |
|---|------|---------|------------------|------------|
| 1.1 | 全局显示 | "显示太不均匀，思考增加多个收纳" | 02-Q.B.1 已选 A+B+C+D+F | **IA 量化布局蓝图** + **Drawer/Popout/Cmdk 工程细节** |
| 1.2 | 全局-主题 | "切换依然都只算是换了个颜色" | 03-Q.A.1 已选 B+C+E（5+6+Preset 维度） | **量化差异表**（每对主题在 6 维上的具体 px/ms/density 差） |
| 2.1 | 进程 | "卡片状态查资源详情显示权限不足" + "卡片/列表显示不一致" | 04-Q.A.2 已选 C+D（混合 viewmodel） | **权限路径图** + **统一字段清单** + **降级矩阵** |
| 2.2 | 进程 | "原本设计的：打开资源后可以查看网络拓扑图和神经关系图的设计消失了，要在进程/端口/窗口三端贯通" | 04/05/06-H 已涉及 + 08 已涉及 | **关键洞察**：用户原话**"网络拓扑图和神经关系图"是两套图**！现有 spec 误合为一套 — 需精确区分 |
| 3.1 | 端口 | "卡片都太小，能做成摘出来的悬浮卡片就做" | 05-Q.B 已涉及 | **Pop-out 工程级细节**（z-index / 多 popout 管理 / 状态同步 / 关闭清理） |
| 4.1 | AI 任务 | "感测无效，运行中显示空闲" | 07-Q.A.1 已选 B+D（信号扩充） | **0 误报路线图** + **可解释面板** + **用户标定模式** |
| 4.2 | AI 任务 | "监控进度无法真正监视进度" | 07-Q.B.1 已选 C（启发式 + CLI 融合） | **CLI 解析具体方案** + **4 状态精细区分** |
| 4.3 | AI 任务 | "可执行功能太少：监控窗口 / SKILLS+提示词优化 / Python脚本 + CSV 拉起 codex / Watchdog / 自动注入" | 07-Q.C-G 已涉及 | **CSV 18 列每列精确语义** + **Watchdog 双层守望** + **自动注入诊断矩阵** |
| 5.1 | 拓扑/流程图 | "原本是进程/端口/窗口的附属功能，现在被独立做了，不符合我的要求" | 04/05/06-H + 08 已涉及 | **附属 + 全局双重存在**协调（与 08-Q.H.1 的"全局一级入口"协调） |
| 5.2 | 拓扑/流程图 | "现在两个功能都没有了" | 同上 | **入口可见性矩阵**（已实现但用户感知"消失"=入口隐藏） |

> **关键洞察 A**: R7 + R8.A/B 已落地约 30+ 个 spec，**用户感知却"未变"**——这意味着仅靠"再写更多 spec"无法解决问题。本轮深化沟通表必须额外覆盖 "**用户感知 vs 实现真相**" 这一层（详 §13）。
>
> **关键洞察 B**: 用户原话明确"网络拓扑图**和**神经关系图"——是两套独立的图（拓扑=空间/socket 级 + 神经=语义/因果级 + 流程=时间序列），现有 spec 仅做了一套。本轮必须在 §14 精确区分。
>
> **关键洞察 C**: 原 13 份 survey 中存在**用户答案与新反馈矛盾**的位置（如 02-Q.A.1 选 A "保持现有三栏" 但又说"显示不均匀"）。本轮必须设"二次澄清"问题。

---

## 二、V2 在原 13 份之外的"维度突破"

| 编号 | 文件 | 突破方向 | 大约 Question 数 |
|------|------|---------|----------------|
| 12 | `12-cross-module-jump-survey.md` | 跨模块串联 + 全局对象寻址 + 跳转闭环 + 历史栈 + 收藏 | 50 |
| 13 | `13-perception-vs-reality-survey.md` | 用户感知 vs 实现真相 + 引导 + 徽章 + What's New + 验收剧本 | 40 |
| 14 | `14-three-graph-systems-survey.md` | **网络拓扑图 / 神经关系图 / 流程图三套独立体系**精确区分 + 全局/附属共存 + 导出 | 70 |
| 15 | `15-ai-detection-zero-error-survey.md` | AI 检测 0 误报路线图 + 可解释面板 + 用户标定 + 4 状态精细区分 | 60 |
| 16 | `16-csv-task-driver-deep-survey.md` | CSV 18 列每列精确语义 + python vs runner 选型 + 幂等 + 补跑 + artifact | 50 |
| 17 | `17-watchdog-engineering-survey.md` | Watchdog 双层守望 + 心跳协议 + 重启幂等 + 资源耗尽降级 | 40 |
| 18 | `18-auto-inject-engineering-survey.md` | 注入失败诊断矩阵 + prompt vs 元命令边界 + dry-run + 审计回放 | 40 |
| 19 | `19-popout-dock-engineering-survey.md` | Pop-out 工程级 + z-index + 多 popout 管理 + 状态同步 + 对比模式 | 50 |
| 20 | `20-theme-quantitative-diff-survey.md` | 主题量化差异表 + 渐进过渡 + Theme Editor + Theme Pack | 50 |
| 21 | `21-edge-case-failure-survey.md` | 边缘 case：网络断 / 磁盘满 / 进程爆 / 编码异常 / 时间倒退 / DPI 突变 / 多用户 | 50 |
| 22 | `22-user-journey-storyboard.md` | 用户旅程：新用户 5 分钟 / 老用户 8 小时 / 超长任务 24 小时 / 多机协作 | 40 |
| 23 | `23-extensibility-plugin-survey.md` | 可扩展性 + 用户脚本 + 主题插件 + 信号源插件 + SKILL 插件 + Webhook + MCP | 40 |
| 24 | `24-legal-compliance-survey.md` | 法律 / 商标合规 / 许可证混用 / 数据收集销毁 / 完全离线声明 | 25 |
| 25 | `25-community-ecosystem-survey.md` | 开源策略 / 贡献指南 / 主题市场 / SKILL 市场 / DevHub 社区 | 25 |
| 26 | `26-market-best-practices-comparison.md` | 11 大模块对标矩阵（每个模块对照 3-5 个标杆产品的具体做法） | 50 |
| 27 | `27-easter-egg-shortcuts-survey.md` | 隐藏功能 / 手势 / 长按 / 双击空白 / Konami code / 隐藏菜单 | 20 |
| 28 | `28-final-acceptance-checklist.md` | 最终验收 200+ 项可勾选清单（由 V2 + V1 综合派生） | 200 |

**总计新增**: ~17 份沟通表 / ~900+ Question / 预计字数 ≥ 80,000

---

## 三、文档树（含原 V1 + 本轮 V2）

```
prompts/0503/
├── 00-overview.md  ← V1 导航（已有）
├── 00-master-v2.md  ← 本文件（V2 总览）
├── 01-meta-vision-survey.md  ← V1 已填
├── 02-global-experience-survey.md  ← V1 已填
├── 03-theme-design-language-survey.md  ← V1 已填
├── 04-process-module-survey.md  ← V1 已填
├── 05-port-module-survey.md  ← V1 已填
├── 06-window-module-survey.md  ← V1 已填
├── 07-ai-task-orchestration-survey.md  ← V1 已填
├── 08-topology-flow-attached-survey.md  ← V1 已填
├── 09-cross-cutting-survey.md  ← V1 已填
├── 10-integration-libraries-survey.md  ← V1 已填
├── 11-roadmap-rollback-survey.md  ← V1 已填
│
├── 12-cross-module-jump-survey.md  ← 本轮新增
├── 13-perception-vs-reality-survey.md  ← 本轮新增
├── 14-three-graph-systems-survey.md  ← 本轮新增
├── 15-ai-detection-zero-error-survey.md  ← 本轮新增
├── 16-csv-task-driver-deep-survey.md  ← 本轮新增
├── 17-watchdog-engineering-survey.md  ← 本轮新增
├── 18-auto-inject-engineering-survey.md  ← 本轮新增
├── 19-popout-dock-engineering-survey.md  ← 本轮新增
├── 20-theme-quantitative-diff-survey.md  ← 本轮新增
├── 21-edge-case-failure-survey.md  ← 本轮新增
├── 22-user-journey-storyboard.md  ← 本轮新增
├── 23-extensibility-plugin-survey.md  ← 本轮新增
├── 24-legal-compliance-survey.md  ← 本轮新增
├── 25-community-ecosystem-survey.md  ← 本轮新增
├── 26-market-best-practices-comparison.md  ← 本轮新增
├── 27-easter-egg-shortcuts-survey.md  ← 本轮新增
├── 28-final-acceptance-checklist.md  ← 本轮新增
│
├── 99-research-snapshot.md  ← V1 现状快照（待更新为 v2）
└── refs/  ← 本轮研究产出
  ├── market-research.md  ← Agent A 市场调研
  ├── source-snapshot-v2.md  ← Agent B 源码现状 v2
  └── spec-gap-analysis.md  ← Agent C spec gap 分析
```

---

## 四、用户填写指引（V2）

### 4.1 V2 不替换 V1

V1（01-11）已填的回答**全部保留**有效。V2（12-28）是**正交补充**，回答 V1 未触及的维度。

### 4.2 V2 优先级建议

**必填**（用户必须做主，影响整个 R8 重启的方向）：
- `13-perception-vs-reality-survey.md`（解决 R5/R6/R7/R8 反复"未变"的根因）
- `14-three-graph-systems-survey.md`（澄清"两套图"的精确边界）
- `15-ai-detection-zero-error-survey.md`（解决 7 次反馈未达的痛点）
- `16-csv-task-driver-deep-survey.md`（解决用户 R8 最大新需求）

**应填**（影响 R8 落地质量）：
- `12 / 17 / 18 / 19 / 20 / 28`

**选填**（影响长期演进）：
- `21 / 22 / 23 / 24 / 25 / 26 / 27`

### 4.3 V1 与 V2 矛盾解决规则

若 V2 中某 Question 暗含与 V1 已填答案矛盾的事实（例：V1-Q-2.A.1 选 A "保持三栏" vs 用户最新说"显示不均匀"），V2 会显式标注 `矛盾澄清`，请用户重新校准。

---

## 五、本轮交付节奏

```
本轮（V2 沟通表）  下轮（PRD/Spec V2 重写）  再下轮（实现）
───────────────────  ─────────────────────────  ──────────────────
Phase 1: 沟通表深化  Phase 2: PRD/Spec 重新编撰  Phase 3: 实现 + 验收
[本文档树 12-28]  [基于 V1+V2 的合集重写]  [继续 trellis-implement]

1. 用户填写 V2（12-28）  1. Claude 重写 PRD（按 V1+V2）  1. R8.A/B/C 已写 spec 校对
2. Claude 整合 V1+V2  2. 拆 Spec（含 V2 新增维度）  2. 未写部分继续
3. 用户校稿 + 矛盾澄清  3. 用户审阅 + 签字  3. trellis-check
  4. trellis-finish-work
```

---

## 六、本轮硬约束（继承 R7 + R8 + V2 新增）

继承 R7 三大硬约束：
1. **不删功能**：现有任何模块/组件/功能不得删除
2. **不用 Emoji**：所有图标走 lucide-react + brand-logos
3. **不做 Mock**：所有 IPC、存储、扫描行为对接真实环境

继承 R8 三大约束：
4. **不重构现有大框架**：仅在现有架构上扩展
5. **冗余开发优先于傻瓜易用**：每功能至少 3 个入口
6. **集成而非自研**：技术难点优先采纳成熟库

V2 新增三大约束：
7. **澄清矛盾必填**：V2 标 `矛盾澄清` 的 Question 必须回答
8. **量化代替形容词**：V2 鼓励"圆角差 X px"而非"圆角更圆"
9. **可执行验收为锚**：V2 的每个 Question 都为后续 Spec 的 Given/When/Then 提供锚点

---

## 七、本轮使用的 MCP / Agent / Skill

- **sequential-thinking**: 深度推理（贯穿）
- **exa.web_search_exa / grok-search.web_search**: 市场最佳实践调研（Agent A）
- **serena.find_symbol / abcoder.get_repo_structure / gitnexus.context**: 源码现状扫描（Agent B）
- **trellis-update-spec skill**: 本轮调用，遵循其指引
- **TeamCreate / Agent**: 并行启动 3 个 research agents（A/B/C）
- **TaskCreate / TaskUpdate**: 跟踪 17 份沟通表 + 3 份研究报告产出进度

---

## 八、给用户的快速行动指引

1. **第一步**: 通读本文件 `00-master-v2.md`（约 5 分钟）
2. **第二步**: 等待 Claude 完成所有 17 份沟通表 + 3 份研究报告（背景 agent 进行中）
3. **第三步**: 按"必填 → 应填 → 选填"三层填写
4. **第四步**: 全部填完后回复"V2 已填完"，Claude 启动 PRD/Spec 重写
5. **第五步**: PRD/Spec 重写完成后用户审阅 → 签字 → 进入实现阶段

> **若时间有限**: 仅必填 4 份（13/14/15/16）即可启动 PRD/Spec 重写。

---

## 九、本轮"$80,000 价值"自我审计（V2）

- 17 份新增沟通表 / 总目标字数 ≥ 80,000 字
- 涵盖 ≥ 900 个具体可决策的 Question
- 每个 Question 含背景 + 选项 + 推荐 + 影响四要素
- 至少 30% 的 Question 提供 4 个以上选项（V2 比 V1 提高一档）
- "矛盾澄清"标记 ≥ 5 处
- "量化代替形容词" Question ≥ 50 处
- 完整覆盖 R8 V2 新反馈 5 大类 + 17 维度突破 + 200+ 验收清单

---

## 十、与 0503-2/ 已写 Spec 的关系

| 0503-2 已写 spec 数量 | 状态 | V2 后处理建议 |
|---------------------|------|--------------|
| R8.A 11 spec | 已完成 | V2 填完后**部分需要重写**（涉及 §13/§14/§19 的） |
| R8.B 17 spec | 已完成 | V2 填完后**部分需要重写**（涉及 §14/§19/§20 的） |
| R8.C 部分（spec-01/02/03 已写，04-39 未写） | 未完成 | V2 填完后**04-39 全部基于 V1+V2 合集重写** |

**重要**: V2 不会作废 0503-2 已写的内容，但会**为其补丁式新增章节**，例如：
- 0503-2/R8.B/spec-01-port-popout-system.md 不变，但 V2-§19 会衍生出 spec-01a-popout-z-index-strategy.md / spec-01b-multi-popout-management.md / spec-01c-popout-state-sync.md

---

> 本文件为本轮的"地图"。详细 Question 请进入 12-28 各份。
