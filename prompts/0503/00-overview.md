# DevHub R8 — 0503 需求穷尽分析与需求表导航

> 本轮日期: 2026-05-03
> 作者: Claude (Opus 4.7) + ZRainbow（待审阅）
> 性质: **需求收集轮（Requirements Survey Round）**，本轮不写源码，不开 PRD，不开 Spec
> 上一轮: R6（0420 手测）+ R7（0421 30 份企业级 spec）+ master implementation sweep
> 本轮目标: **基于 R6 残留 + R8 新增 8 类问题，产出穷尽式需求表交用户填写**

---

## 一、本轮触发上下文（R8 用户痛点 8 大类）

用户在 2026-05-03 反馈：

| # | 板块 | 主诉 | R6/R7 锚点 | 本轮性质 |
|---|------|------|------------|----------|
| 1.1 | 全局显示 | 显示太不均匀，需要"多个收纳"机制 | R6-P8.1 局部 + 新泛化 | **新增** |
| 1.2 | 全局-主题 | 主题切换仍只换色，未到布局/组件/动效层 | R6-P8.2（**第 7 次反馈**） | **回退/未达** |
| 2.1 | 进程 | 卡片模式资源详情显示"权限不足"需提权，且与列表模式不一致 | R6-P2.2 子症状 | **新增子项** |
| 2.2 | 进程 | "打开资源后查看网络拓扑/神经关系图"的设计消失 | R7-spec/02 实现入口可见性问题 | **可见性回退** |
| 3.1 | 端口 | 卡片太小，需做成"摘出来的悬浮卡片"，全屏下亦显示紧张 | R6-P3.1/P4.1 衍生 | **新增** |
| 4.1 | AI 任务 | AI 编程窗口感测无效，运行中显示空闲，误报/瞎报/错报 | R6-P4.2-b（**第 7 次反馈**） | **未达** |
| 4.2 | AI 任务 | 监控进度功能无法真正监视进度，迟报/漏报/错误后仍报 | R6-P5.1（**第 7 次反馈**） | **未达** |
| 4.3 | AI 任务 | 可执行功能太少，需要：监控窗口（SKILLS+提示词+CSV+codex 持续工作）/ Watchdog / 自动注入 | 全新扩展 | **重大新增** |
| 5.1 | 拓扑/流程 | 必须是进程/端口/窗口的附属查询，被独立做不符合要求 | R7-spec/02（已落地但用户感知未变） | **可见性回退** |
| 5.2 | 拓扑/流程 | 现在两个功能都"没有了" | 同上，入口被埋 | **可见性回退** |

> **关键洞察**: R7-spec/02（拓扑附属化）在 2026-04-30 已 TEST-PASS，`MonitorPanel.tsx:10` 现仅有 4 个顶级 Tab（`process / port / window / ai-task`），附属图入口落在各详情面板内。但用户感知"功能消失"——意味着**入口可见性、引导、空态提示、回归测试覆盖率**均不足。这不是技术回退，而是 UX 信号回退。

---

## 二、本轮"冗余开发"的拓展方向（基于市面最佳实践）

为达到用户要求的 **100% 可用性 / 丰富性 / 完善性**，本轮在用户原始 8 大类之外主动拓展以下方向（每项均落入需求表的相应分支由用户决策）：

### 2.1 全局信息架构层
- **多窗格主面板（Multi-pane）**: 类 VSCode Side Panel + Terminal + Editor 三栏可拖拽
- **命令面板（Command Palette, Ctrl/Cmd+K）**: 全局动作搜索 + 项目跳转 + 进程定位 + 端口聚焦
- **抽屉式收纳（Drawer System）**: Top/Right/Bottom 三向 Drawer 用于"详情/历史/筛选"
- **悬浮卡片（Floating Card / Detached Window）**: 进程/端口/窗口卡片可"摘出"成独立窗口或全屏 Overlay
- **仪表板自定义（Customizable Dashboard）**: react-grid-layout 拖拽小部件
- **状态栏分组（Status Bar Sections）**: 左中右三区 + Toast 通知聚合

### 2.2 主题系统深化层
- **正交四维设计语言**: theme（色板）× density（紧凑/标准/舒适）× radius-family（直角/圆角/混合）× motion-level（关闭/降级/标准/丰富）
- **装饰几何切换**: 当前 Constructivism 风的对角线 / Cyberpunk 风的扫描线 / Warm-Light 风的纸张纹理 — 三者在切换时除颜色外，**装饰图案、字体、阴影、动效、卡片密度**均应不同
- **运行时主题预览（Live Preview）**: 设置面板内实时预览缩略图
- **主题导入/导出（Theme JSON）**: 用户可自定义主题
- **辅助功能（A11y）**: 高对比模式 / 大号字号 / Reduce Motion 各档独立可控

### 2.3 AI 任务编排层（用户最重要的扩展）
- **CSV 任务驱动器（CSV Task Driver）**: 用户在 CSV 中定义任务批次，DevHub 启动 Python 桥接拉起 codex/claude/gemini 持续工作
- **SKILL 库（Skill Library）**: 内置可复用提示词模板 + 变量插槽 + 调用宏
- **Watchdog 引擎（Watchdog Engine）**: 心跳检测 + 卡死判定 + 自动重启 + 自动重新注入上下文
- **任务编排 DAG（Task Orchestration DAG）**: 串联 codex → claude → gemini 流水线（轻量 prefect-style）
- **进度可信度（Progress Confidence）**: 多信号融合（CPU 方差 + 子进程 + 文件变更 + 终端输出 OCR）+ 置信度区间
- **任务录像（Task Recording）**: 全程记录 stdin/stdout，可回放
- **失败处理策略**: 重试次数 / 退避 / 切换工具 / 升级模型 / 通知人工
- **审计追踪（Audit Trail）**: 每条命令、每次重试、每次外部操作均落 Append-only 日志

### 2.4 进程模块拓展
- **多视图（Card / Compact List / Tree / Treemap）**: Treemap 按 RSS 占比可视化大头进程
- **进程操作清单**: kill / suspend / resume / set affinity / set priority / dump（procdump）/ open file location / 复制 commandline
- **进程标签（User Tags）**: 用户可手动给进程打标签（例如"我的 dev server / 同事的 / 系统"）
- **进程历史（History Trace）**: 30 分钟内进程出现/消失时间线

### 2.5 端口模块拓展
- **悬浮卡片（Detachable Pop-out）**: hover 预览 → click 锁定 → drag 自由摆放 → 双击全屏
- **端口安全分级**: 仅本地 (127.0.0.1) / LAN / 公网 / 监听全部接口 (0.0.0.0) — 视觉徽章不同
- **端口冲突可视化**: 同端口多 PID 时高亮冲突链
- **端口 → 项目自动关联**: 通过 cwd 推断属于哪个项目卡片
- **端口请求嗅探（可选 P2）**: 集成 mitmproxy MCP（项目已装）做 HTTP 包嗅探

### 2.6 窗口模块拓展
- **窗口分组持久化策略**: 按 hwnd 不可靠 → 改为 (exe_path, title_pattern, project_cwd) 三元组指纹
- **窗口操作矩阵**: rename / always-on-top / screenshot / inject-text / send-key / minimize-others / focus-with-flash
- **AI 工具实例消歧**: 同时 4 个 Claude Code 实例 → 通过 "工作目录 + 启动时间 + window title hash" 三维识别
- **窗口聚类**: 按 EXE / 项目 / 工作目录自动建议分组
- **窗口跨虚拟桌面**: 跟踪窗口在 Win11 虚拟桌面之间的移动

### 2.7 拓扑/流程图模块拓展
- **入口可见性强化**: 详情面板默认展开关系视图首屏 + Tooltip 引导 + 空态插画
- **多种布局算法**: force（默认）/ dagre（层级）/ circular（圆形）/ elkjs（精确分层）+ "智能选择"
- **图缩放与小地图**: 节点 > 50 时启用 minimap
- **图历史快照**: 任意时刻保存当前关系图供后续对比（看变化）
- **跨进程图谱（Process Tree Map）**: 类 procexp 的进程树视图作为补充

### 2.8 横切关注点
- **权限模型（Permission Matrix）**: 哪些操作需 UAC / 哪些只需用户确认 / 哪些自动放行
- **可观测性面板（DevObservabilityPanel）**: 默认开启 / 仅 dev 模式 / 用户可见
- **数据契约校验**: Zod 全链路 schema validation
- **IPC 限流**: 全局 token bucket + 每通道 RPM
- **崩溃恢复**: 自动保存 store 快照 / 启动时检测 dirty state
- **遥测（Telemetry）**: 完全可选，本地优先 OTLP，**绝不外发**

### 2.9 集成参考库（已纳入选项让用户决策）
- 进程: `wmi-client`, `ps-list`, `systeminformation`, `tree-kill`
- 窗口: `active-win`, `koffi`（FFI）, `node-window-manager`, `win32-displayconfig`
- AI 感测: `chokidar`, `node-pty`, `screenshot-desktop`, OCR via `tesseract.js`
- 拓扑: `@xyflow/react`, `cytoscape`, `sigma.js`, `elkjs`, `dagre`
- 命令面板: `cmdk`, `kbar`
- 仪表板: `react-grid-layout`, `react-resizable-panels`
- Watchdog: `pm2`-style 自建, `nodemon` 思路, `forever`
- CSV/编排: `papaparse`, 自建 prefect-mini

---

## 三、需求表文档树（用户填写顺序）

> **填写约定**: 每份文档分为 N 个 Question Group。每个 Question 形如 `[Q-X.Y.Z]`，包含背景、选项、推荐默认、影响、用户回答区。**用户只需在"用户回答"行选择或填写**，未填写视为接受推荐默认。

```
prompts/0503/
├── 00-overview.md  ← 本文件（导航）
├── 01-meta-vision-survey.md  ← 元层：愿景、用户画像、设备、性能预算、数据保留
├── 02-global-experience-survey.md  ← 全局体验：IA、布局、收纳、密度、字体、响应式、国际化
├── 03-theme-design-language-survey.md  ← 主题深度：四维正交、装饰几何、动效层级、A11y、自定义
├── 04-process-module-survey.md  ← 进程模块：双模一致、详情字段、操作清单、过滤分组、权限提升
├── 05-port-module-survey.md  ← 端口模块：悬浮卡片、安全分级、冲突可视化、嗅探集成
├── 06-window-module-survey.md  ← 窗口模块：AI 实例消歧、分组持久化、操作矩阵、跨桌面
├── 07-ai-task-orchestration-survey.md  ← AI 任务编排（最大）：感测、进度可信度、SKILL、CSV、Watchdog、自动注入、DAG
├── 08-topology-flow-attached-survey.md  ← 拓扑/流程：入口位置、布局算法、深度控制、跨视图跳转
├── 09-cross-cutting-survey.md  ← 横切：权限、可观测性、IPC、日志、备份、遥测
├── 10-integration-libraries-survey.md  ← 集成库选择：处理器/窗口/AI/拓扑/命令面板/仪表板各类候选
├── 11-roadmap-rollback-survey.md  ← 节奏：批次划分、灰度、回滚、Demo 脚本、验收门
└── 99-research-snapshot.md  ← 当前源码状态快照（佐证用，无需填写）
```

---

## 四、用户填写指引

### 4.1 优先级标记

每个 Question 在标题行注明三个属性：

- **决策权重**: ` 锚定（用户必须做主）` / ` 协商（推荐+可改）` / ` 委托（接受推荐即可）`
  > 注：以上 emoji 仅作 Markdown 渲染色块用，**不进入产品 UI**
- **MoSCoW**: `[Must] / [Should] / [Could] / [Won't]`
- **关联模块**: 影响哪些 Spec 文件 / 哪些源码

### 4.2 回答方式

```markdown
[Q-X.Y.Z] 问题标题  [决策权重] [MoSCoW] [关联模块]

**背景**: 简述为什么问这个问题，已有的现状

**选项**:
- A. 选项 A 描述
- B. 选项 B 描述
- C. 选项 C 描述
- D. 自由填写：________

**推荐默认**: B（理由: ...）

**影响范围**: 选 A 会触发 Spec X.Y / 影响 N 个文件

**用户回答**: ________________________
```

### 4.3 跳过规则

- 用户回答 `跳过` 视为采纳"推荐默认"
- 用户回答 `不做` 视为该项移入 Won't（R9 再议）
- 用户填写"自由文本"视为新增需求，需在审阅环节单独 PRD 化

---

## 五、本轮交付节奏

```
本轮（R8 0503）  下轮（R8 implement）  再下轮（R8 verify）
─────────────────  ─────────────────────────  ─────────────────────
Phase 1: 需求穷尽  Phase 2: PRD/Spec 编撰  Phase 3: 实现 + 验收
[本文档树]  [按填写后的需求表展开]  [Playwright E2E + 手测]

1. 用户填写需求表  1. 拆 PRD（按模块）  1. trellis-implement
2. Claude 审核  2. 拆 Spec（按 RFC 风格）  2. trellis-check
3. 用户校稿  3. trellis-research  3. trellis-finish-work
  4. 用户审阅
  5. 用户签字 (sign-off)
```

---

## 六、本轮硬约束（继承 R7 + R8 新增）

继承 R7 三大硬约束：
1. **不删功能**：现有任何模块/组件/功能不得删除，仅"深化、替换、补齐、重挂载"
2. **不用 Emoji**：所有图标走 `lucide-react` + 项目 `src/renderer/components/icons/` + 新建 `brand-logos/`，**Emoji 字符（U+1F300–U+1FAFF / U+2600–U+27BF）零容忍**
3. **不做 Mock**：所有 IPC、存储、扫描行为对接真实 Win32 / 真实进程 / 真实 electron-store

R8 新增三大硬约束：

4. **不重构现有大框架**：仅在现有架构上扩展，不动 Electron 主/渲染进程的边界、不换状态管理库、不换样式方案、不换图引擎
5. **冗余开发优先于傻瓜易用**：每个功能至少提供 3 个入口（菜单/快捷键/命令面板），用户能从任意上下文触达
6. **集成而非自研**：技术难点优先采纳成熟库（清单见 `10-integration-libraries-survey.md`），自研仅在确无可用库时

---

## 七、本轮使用的 MCP / Agent / Skill

- **sequential-thinking**: 多轮深度分析，本文档与 01–11 各文档均在草稿阶段使用
- **serena**: 当前源码状态快照（`99-research-snapshot.md`）
- **gitnexus**: 影响范围分析（写 spec 时使用，本轮预热）
- **exa / grok-search**: 市场最佳实践调研（`10-integration-libraries-survey.md`）
- **Agent (Explore subagent)**: 当前 8 模块状态并行核查
- **TaskCreate**: 跟踪本轮 11 文档产出进度（仅本会话）

---

## 八、给用户的快速行动指引

1. **第一步**: 通读本文件 `00-overview.md`（约 5 分钟）
2. **第二步**: 按顺序填写 `01-meta-vision-survey.md` → `11-roadmap-rollback-survey.md`，每份 5–20 分钟
3. **第三步**: 全部填完后回复 "需求表已填完"，Claude 启动 PRD/Spec 编撰
4. **第四步**: PRD/Spec 完成后用户审阅 → 签字 → 进入实现阶段

> **若时间有限**: 仅必填带 ` 锚定` 与 `[Must]` 双标记的 Question，其余采用推荐默认即可启动 R8 第一批次。

---

## 九、本轮"$80,000 价值"自我审计

- 12 文档（含本导航）目标总字数 ≥ 30,000 字
- 涵盖 ≥ 200 个具体可决策的 Question
- 每个 Question 含背景 + 选项 + 推荐 + 影响四要素
- 至少 30% 的 Question 提供 3 个以上选项
- 所有"冗余开发"建议均落入 Question，由用户决策保留/移除
- 完整覆盖 R6 13 个原始问题 + R8 8 类新痛点 + 30+ 拓展方向
