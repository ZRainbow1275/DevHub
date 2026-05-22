# 07 — AI 任务编排决策（提炼版）⭐⭐⭐⭐⭐

> **派生自**: `prompts/0503/07-ai-task-orchestration-survey.md`
> **R8 优先级**: #3（CLI 解析）+ #4（感测调优）+ #5（监控窗口）→ R8.C 主战场
> **核心痛点**:
> - AI 编程窗口感测无效（运行中显示空闲、误报/瞎报/错报）
> - 监控进度迟报/漏报/错误后仍报
> - 功能太少（缺监控窗口、Watchdog、自动注入）
> **用户最强诉求**: 「**监控**」（[Q-7.K.1]）

---

## A. 感测引擎调优

### A.1 6 信号策略（[Q-7.A.1] [ACCEPT]）
**用户回答**: B + D — 保留 6 信号 + 新增 4 信号 + 插件接口

### A.2 新增信号源（[Q-7.A.2] [ACCEPT]）
**用户回答**: 沿用默认

| 维度 | 选项 |
|------|------|
| **屏幕 OCR** | 第 3 项（截图差异 + OCR） |
| **stdout 解析** | 第 3 项（SHIM 脚本）+ 第 4 项（结构化 JSON） |
| **文件系统** | chokidar 监听 cwd + git status 变化 |
| **网络** | netstat 端口活动（已有） |
| **Windows ETW** | 启用（spawn 高精度） |

> **OCR 注意**: 与 10.D.3 [NO OCR] 冲突 → R8.A 实现接口但默认关闭

### A.3 信号融合算法（[Q-7.A.3] [ACCEPT]）
**用户回答**: A + E — 加权求和 + 用户反馈循环（不引入 ML）

### A.4 状态机（[Q-7.A.4] [ACCEPT]）
**用户回答**: C — 三层状态
- **系统层** = idle / active
- **任务层** = phase（thinking / running / completing / waiting / errored）
- **UI 层** = 展示态（如何渲染给用户）

→ 强制一致性约束：UI 层只能从任务层派生，任务层只能从系统层派生

### A.5 误报反馈循环（[Q-7.A.5] [ACCEPT]）
**用户回答**: D — 透明度最高
- 每个通知附"是误报"按钮
- 周期性回顾（每周展示自动调整记录）
- **信号贡献透明度**：显示每条通知是哪几个信号触发，用户可指认"这个信号没用"

### A.6 误报阈值（[Q-7.A.6] [ACCEPT]）
**用户回答**: D + A 兜底 — 自动校准 + 保持当前值兜底

---

## B. 进度可信度

### B.1 进度计算方式（[Q-7.B.1] [ACCEPT]）
**用户回答**: C — 启发式 + CLI 真实输出 混合，置信度区间

显示格式：「进度 56% [置信度 75%]」

### B.2 各 CLI 解析支持（[Q-7.B.2] [CHANGE]）
**用户回答**: 参照默认（每家不同）

| CLI | 默认/用户确认方案 |
|-----|------|
| **Codex CLI** | **D** — SHIM（DevHub 控制 codex 进程的 stdio） |
| **Claude Code** | **C + D** — JSON 流（`--output-format=stream-json`） + SHIM |
| **Gemini CLI** | **B + D** — stdout 解析 + SHIM |
| **Cursor / Copilot** | **B + C** — 窗口标题 + 文件系统变化 |

→ 新增 `CLIOutputParser` 模块（约 600 LoC + 每家 CLI 独立解析器）

### B.3 进度 UI（[Q-7.B.3] [ACCEPT]）
**用户回答**: B + D + E + F
- 进度条（线性）
- 置信度区间
- 阶段指示器（"Phase 3/5: Coding"）
- 预计完成时间（"剩余约 2 分钟"）

### B.4 进度回退（[Q-7.B.4] [ACCEPT]）
**用户回答**: D — 保留高水位 + 历史折线

---

## C. 监控窗口

### C.1 形态（[Q-7.C.1] [ACCEPT]）
**用户回答**: D — A+B 混合（Tab 子面板 + 可摘出独立子窗口）

### C.2 功能（[Q-7.C.2] [ACCEPT]）
**用户回答**: 全选

#### 实时态
- 当前所有 AI 任务列表（状态/进度/置信度）
- CSV 批次队列
- 整体吞吐率
- 每个 AI 工具的实例数

#### 历史
- 今日完成任务列表
- 失败重试记录
- Watchdog 介入次数
- 自动注入操作记录

#### 操作
- 启动新 CSV 批次
- 暂停当前批次
- 跳过失败任务
- 强制重启某 AI 实例
- 给某 AI 实例发送追加提示
- 查看任务录像

#### 可观测性
- 每个信号源实时图表
- 每个 IPC 通道的 RPM
- 主进程 / 渲染进程的资源占用

### C.3 刷新频率（[Q-7.C.3] [ACCEPT]）
**用户回答**: D — 用户可调（默认 2s，范围 500ms-10s）

---

## D. SKILL 库

### D.1 SKILL 定义（[Q-7.D.1] [ACCEPT]）
**用户回答**: D + E
- 可复用提示词模板 + 变量插槽
- 钩子（pre/post 处理）
- 输出 schema 验证
- 链式编排（多 SKILL 串成 pipeline）
- **兼容 Anthropic 官方 Agent Skills 格式**（YAML frontmatter + tools/scripts）

### D.2 存储位置（[Q-7.D.2] [ACCEPT]）
**用户回答**: D — 全局 + 项目级 + 内置

- `%APPDATA%/devhub/skills/` — 用户全局
- `.devhub/skills/` — 项目级
- 内置 SKILL — DevHub 自带

### D.3 内置库（[Q-7.D.3] [ACCEPT]）
**用户回答**: 全选 — 10 个内置 SKILL

1. 代码评审
2. 写测试
3. 重构提取
4. 文档生成
5. 解 bug
6. 类型补全
7. commit message 生成
8. PR 描述生成
9. CSV 转任务批次
10. 任务总结

### D.4 调用方式（[Q-7.D.4] [ACCEPT]）
**用户回答**: 全选

- 命令面板（Cmd+K）
- AI 任务窗口的 SKILL 抽屉
- 右键菜单
- CSV 任务批次声明（CSV 中的 skill 列）
- Watchdog 自动触发

### D.5 编辑器（[Q-7.D.5] [ACCEPT]）
**用户回答**: D — Monaco/CodeMirror + 实时预览 + 变量提示与校验

---

## E. CSV 任务驱动器

### E.1 CSV Schema（[Q-7.E.1] [ACCEPT]）
**用户回答**: 全部勾选 — 18 列完整模板

| 列 | 说明 |
|----|------|
| id | 任务唯一 ID（必有） |
| tool | codex / claude / gemini / cursor（必有） |
| prompt | 提示词或 SKILL 引用（必有） |
| cwd | 工作目录（必有） |
| timeout | 最大运行时间（秒） |
| retry | 最大重试次数 |
| on_fail | next / abort / human / fallback-tool |
| dependency | 依赖任务 id（DAG） |
| parallel_group | 并行组 ID |
| success_criteria | 成功判定 |
| post_action | 成功后动作 |
| env | 环境变量 JSON |
| input_files | 前置文件路径 |
| output_files | 任务产出文件 |
| alias | 任务别名 |
| priority | high / normal / low |
| tags | 自由标签 |

### E.2 CSV 存储位置（[Q-7.E.2] [ACCEPT]）
**用户回答**: D — 项目级 + 全局合并

### E.3 启动方式（[Q-7.E.3] [ACCEPT]）
**用户回答**: D — 全部支持
- DevHub 内置批次启动器
- Python 脚本桥接（`devhub-batch.py`）
- CLI 子命令（`devhub run-csv tasks.csv`）

### E.4 执行方式（[Q-7.E.4] [ACCEPT]）
**用户回答**: D — N 个 CLI 实例池 + 智能调度（依赖 + 优先级）

### E.5 并发上限（[Q-7.E.5] [ACCEPT]）
**用户回答**: F — 用户运行时调整（默认 3）

### E.6 失败处理（[Q-7.E.6] [ACCEPT]）
**用户回答**: 全部支持

- next / abort / retry / fallback-tool / escalate-model / human / execute-skill

### E.7 成功判定（[Q-7.E.7] [ACCEPT]）
**用户回答**: 全部支持

- CLI 退出码 0
- stdout 含特定字符串
- stdout 不含错误关键字
- git diff 满足条件
- 测试命令通过
- lint 通过
- 文件存在 / 内容匹配
- AI 工具自报告完成信号
- 自定义脚本

### E.8 可视化（[Q-7.E.8] [ACCEPT]）
**用户回答**: E — 全选（任务列表 + 甘特图 + DAG 图 + 进度看板）

---

## F. Watchdog 引擎

### F.1 核心功能（[Q-7.F.1] [ACCEPT]）
**用户回答**: 全选

- 心跳检测
- CPU/RSS 异常检测
- stdout 静默检测
- 窗口无响应检测（IsHungAppWindow）
- 文件系统活动检测
- 自动重启
- 自动重新注入上下文
- 多次失败转策略
- Watchdog 自身健康检查

### F.2 心跳定义（[Q-7.F.2] [ACCEPT]）
**用户回答**: E — 全部（A/B/C/D 任一即心跳）

### F.3 心跳超时（[Q-7.F.3] [ACCEPT]）
**用户回答**: D — 用户可配置（默认 2 分钟）

### F.4 Watchdog 运行位置（[Q-7.F.4] [ACCEPT]）
**用户回答**: B — 独立 Watchdog 子进程（DevHub 崩溃也能继续）

### F.5 注入恢复方式（[Q-7.F.5] [ACCEPT]）
**用户回答**: D — A+B 混合（CLI 支持就用 CLI，否则模拟键盘）

### F.6 告警通道（[Q-7.F.6] [ACCEPT]）
**用户回答**: A + B + C + E + F
- 应用内 Toast
- 系统通知
- 状态栏徽章
- Webhook
- 桌面响铃 / 弹窗强制确认

---

## G. 自动注入

### G.1 注入范畴（[Q-7.G.1] [ACCEPT]）
**用户回答**: 全选

- CSV 任务驱动
- Watchdog 重启后注入恢复
- 任务完成后自动注入下条
- 错误时注入修复 prompt
- 用户预定义 schedule
- 手动 + 模板

### G.2 目标选择（[Q-7.G.2] [ACCEPT]）
**用户回答**: C + D（不要 A 当前焦点窗口）
- CSV 中指定 alias
- AI 工具自报告的 ready 实例池

### G.3 中断性（[Q-7.G.3] [ACCEPT]）
**用户回答**: D — 3s 倒计时默认 + 严格模式可启用

### G.4 审计日志（[Q-7.G.4] [ACCEPT]）
**用户回答**: B — 本地 append-only（含时间 / 目标 / 内容前 200 字符）

---

## H. 任务编排 DAG

### H.1 是否需要（[Q-7.H.1] [ACCEPT]）
**用户回答**: B — 简单依赖（CSV dependency 列 → DAG 自动构建）

> **注**: [Q-11.A.3] 用户保留"任务编排可视化编辑器"作为 R8 范围 — Spec 时需协调

### H.2 引擎实现（[Q-7.H.2] [ACCEPT]）
**用户回答**: C — graphlib（轻量纯 JS）

---

## I. 任务录像

### I.1 录像内容（[Q-7.I.1] [ACCEPT]）
**用户回答**: stdout + stdin + 屏幕截图（事件触发）+ 文件系统改动 + git diff

### I.2 回放界面（[Q-7.I.2] [ACCEPT]）
**用户回答**: B 默认 + C 加分项 — 文本时间线 + 截图缩略，asciinema 风为加分

---

## J. 通知系统

### J.1 事件分级（[Q-7.J.1] [ACCEPT]）
**用户回答**: 按默认表

| 事件 | 级别 |
|------|------|
| 任务开始 | INFO |
| 任务完成 | INFO |
| 任务失败 | ERROR |
| 任务重试 | WARN |
| Watchdog 介入 | WARN |
| 注入操作 | INFO |
| 误报反馈 | INFO |
| CSV 批次完成 | INFO |
| 信号源故障 | WARN |
| Watchdog 自身故障 | FATAL |
| 主进程内存超阈 | WARN |

### J.2 通道矩阵（[Q-7.J.2] [ACCEPT]）
**用户回答**: 按默认表

### J.3 通知聚合（[Q-7.J.3] [ACCEPT]）
**用户回答**: C — 用户可调聚合窗口

---

## K. 自由填写

### K.1 R8 后 AI 任务最强能力（[Q-7.K.1]）
**用户原话**: 「**监控**」
→ 监控窗口是用户最看重的产出

### K.2 API key 管理（[Q-7.K.2]）
**用户回答**: B — **否**，仅依赖 CLI 自身配置（DevHub 不存储 API key）

### K.3 自动检测 CLI（[Q-7.K.3]）
**用户回答**: A — 是，自动检测并初始化

### K.4 SKILL 云同步（[Q-7.K.4]）
**用户回答**: C — 后期（R8 不做）

---

## L. PRD 信号

1. **监控窗口是 R8 的"皇冠"**：用户最看重，必须打磨
2. **三层状态机**：消除"运行 + 56% 显示空闲"的歧义
3. **CLI 解析每家定制**：Codex SHIM / Claude JSON+SHIM / Gemini stdout / Cursor 文件
4. **置信度区间**：进度永远附置信度，不假装精确
5. **CSV 18 列完整**：必须覆盖企业级编排
6. **Watchdog 独立子进程**：可靠性优先
7. **API key 不入 DevHub**：尊重 CLI 现状
8. **SKILL 云同步推后**：本地优先
9. **OCR 接口实现 + 默认关**：与 10.D.3 协调
10. **任务编排可视化保留**：[Q-11.A.3] 用户没排除
