# 26 — 市场最佳实践对标矩阵（Market Best Practices Comparison）

> **填写时长**: 约 50–70 分钟（最长一份）
> **重要程度**:  R8 重写 PRD/Spec 的"参照系"。每个模块都要回答"我们与世界顶尖产品的差距在哪"。
> **依赖**: 完成 V1-§02/03/04/05/06/07/08/09/10 + V2-§13/14/15/16 + Agent A 市场调研报告 `refs/market-research.md`
> **核心命题**: DevHub R8 的每个模块都对标 3-5 个标杆产品，提取每家最值得借鉴的具体做法。用户在 11 大模块下逐项勾选"是否引入 + 优先级"。

---

## 引言：对标的方法论

R7/R8 的痛点之一是 **spec 写得多，但每条都是"我觉得应该这样"**，没有"业界顶尖产品是这样"的事实参照。本表把 11 个产品维度，每个维度对标 3-5 个标杆产品，列出**每家具体怎么做**（事实），再给出**3 个最值得 DevHub 借鉴的做法**让用户勾选。

**Agent A 市场调研事实** (`refs/market-research.md`) 已提供 11 大模块的标杆产品清单：
1. 信息架构 + 收纳系统：VS Code / Linear / Raycast / Notion
2. 浮窗管理：Stage Manager / Win11 Snap / Spotify Mini / OBS
3. 命令面板：VS Code / Raycast / cmdk / Notion
4. 大规模图表：yFiles / Cytoscape / Linkurious / xyflow
5. AI Agent 编排：Temporal / Prefect / Airflow / KedroML
6. Watchdog：systemd / PM2 / supervisord / Process Hacker
7. CLI PTY：node-pty / xterm.js / Warp / Tabby
8. AI 进度检测：LangSmith / Langfuse / Arize / DeepEval
9. 主题系统：Linear / Vercel / Stripe / Tailwind UI
10. Process 监控：Process Hacker / System Informer / Process Explorer / Activity Monitor
11. 图标库：Lucide / Phosphor / Iconoir / simple-icons

**本表为 R8 PRD/Spec 重写提供"业界对标 + 用户取舍"双输入。**

---

## A. 信息架构 + 收纳系统

### 标杆产品的具体做法

| 产品 | 主侧栏 | 二级导航 | 折叠/展开 | 自定义 | 密度切换 |
|------|------|--------|---------|------|--------|
| **VS Code** | Activity Bar 5-7 图标，可拖拽排序 | Side Bar 列表 + Outline | Cmd+B 折叠 Sidebar / Ctrl+\\ 折叠 Panel | 右键 Activity Bar 隐藏图标 | 字体大小调节，无统一密度 |
| **Linear** | 左侧固定 5 项（Inbox/My Issues/Active/Backlog/Cycles） | 项目列表内嵌 | Cmd+/ 折叠侧栏 | 团队/项目可固定 | 仅支持 Comfortable，无 Compact |
| **Raycast** | 命令面板优先，无侧栏 | 主入口即搜索 | 仅命令面板 | Quicklink 固定项 | 列表项高度可调 |
| **Notion** | 左侧 Workspace 树 + Favorites | 嵌套页面 | 页面级折叠 | 自定义 Sidebar 顺序 | 字体大小 + 全屏 / 普通 |

### DevHub 当前现状

- ProjectSidebar.tsx + ActivityBar 左栏 + MonitorPanel 4-Tab + 详情面板（PortFocusPanel / ProcessDetailPanel / WindowView）
- Q-02-A.1 用户答 A "保持现有三栏" 但又说"显示太不均匀"（V2-Q-13.I.1 已澄清为 D：保持 + Pop-out + 重审密度）
- 无自定义图标顺序 / 无密度统一切换 / 无 Workspace 树
- Cmd+\\ 折叠 Panel 已有，Cmd+B 折叠 Sidebar 未实现

### 推荐借鉴的 3 个做法

- [ ] **VS Code Activity Bar 可拖拽排序**（用户右键隐藏不常用图标）
- [ ] **Linear 固定项 + 收藏夹分离**（"我关注的进程 / 端口 / 窗口"独立区）
- [ ] **Notion 嵌套树**（项目 → 进程 → 端口 → 窗口的可折叠层次）

### [Q-26.A.1] 信息架构借鉴选择  锚定 [Must]

**选项**: 上述 3 个做法 - 是否引入 + 优先级

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| VS Code 可拖拽排序 |  |  |
| Linear 固定项 + 收藏夹 |  |  |
| Notion 嵌套树 |  |  |

**用户回答**: ________________________

---

### [Q-26.A.2] 是否新增第 4 个借鉴做法（用户自填）  委托 [Could]

**用户回答**: ________________________

---

## B. 悬浮卡片 / Pop-out

### 标杆产品的具体做法

| 产品 | 触发方式 | 默认尺寸 | 多窗口管理 | 状态同步 | 关闭策略 |
|------|--------|--------|----------|--------|--------|
| **PiP (浏览器)** | 右键 video → PiP | 320x180 | 单 PiP，新触发覆盖 | 视频继续播放 | 用户拖关闭 / 关源页面 |
| **Stage Manager (macOS)** | 拖窗口到边缘 | 任意 | 多窗口堆叠分组 | 全屏切换时缩小 | 双击空白退出 |
| **Win11 Snap** | 鼠标悬停最大化按钮 | 4 个预设布局 | 多窗口贴边 | 独立窗口 | 拖回原位 |
| **Spotify Mini Player** | 顶部控件按钮 | 320x320 固定 | 单 mini，可调位置 | 与主程序双向同步 | × 按钮关闭 |
| **OBS Studio Multiview** | 工具栏一键 | 动态比例 | 多 multiview 可平铺 | 实时镜像主预览 | 关闭按钮 |

### DevHub 当前现状

- PortFocusPanel:534 已嵌入 AttachedGraphView，但**不是 popout**（仅在主窗口内）
- 无任何浮窗 / 拖出 / always-on-top（除 WINDOW_SET_TOPMOST IPC 已实现但未用于自身）
- 用户原话："卡片太小，能做成摘出来的悬浮卡片就做"
- V2-§19 popout-dock-engineering 将深化

### 推荐借鉴的 3 个做法

- [ ] **PiP 右键拖出**（每个端口/进程/窗口卡片右键"摘出为浮窗"）
- [ ] **Spotify Mini 双向同步**（浮窗内操作实时回写主窗口状态）
- [ ] **Win11 Snap 4 个预设布局**（左半屏 / 右半屏 / 上下 / 四宫格 多浮窗自动排列）

### [Q-26.B.1] Pop-out 借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| PiP 右键拖出 |  |  |
| Spotify Mini 双向同步 |  |  |
| Win11 Snap 预设布局 |  |  |

**用户回答**: ________________________

---

### [Q-26.B.2] OBS Multiview 借鉴（多浮窗实时镜像）  委托 [Could]

**背景**: 用户可同时打开 4 个浮窗，每个跟踪不同进程/端口/窗口。

**选项**: A. 不做 / B. 实现 / C. 实现 + 浮窗对比模式（diff 高亮）

**推荐默认**: B 默认 + C 后期

**用户回答**: ________________________

---

## C. 命令面板（cmdk）

### 标杆产品的具体做法

| 产品 | 触发键 | 多源聚合 | 模糊搜索算法 | 历史 | 命令录制 |
|------|------|--------|----------|----|--------|
| **Vercel Dashboard** | Cmd+K | 仅当前项目 | Fuse.js | 最近 5 项 | 无 |
| **Linear** | Cmd+K | Issue + Project + Members + Settings | 自定义 | 最近 8 项 | 无 |
| **Raycast** | Cmd+Space | 应用 + 文件 + 剪贴板 + Snippet + 第三方扩展 | 多算法融合 | 智能排序（频次 + 时间） | Quicklink + Workflow |
| **Superhuman** | Cmd+K | 邮件 + 联系人 + 设置 | 自定义 | 最近 3 项 | Snippet |
| **VS Code** | Cmd+Shift+P | Command + File + Symbol + Keybinding | 自定义 | 最近 10 项 | Tasks + Macro |

### DevHub 当前现状

- CommandPaletteEnhanced.tsx（已有，使用 cmdk）
- Q-02 用户已要求多源聚合（进程 / 端口 / 窗口 / AI 任务 / 主题 / 设置 / 命令）
- 无智能排序（仅按字母）/ 无 Quicklink / 无录制

### 推荐借鉴的 3 个做法

- [ ] **Raycast 智能排序**（按使用频次 + 时间衰减）
- [ ] **VS Code Tasks 录制**（用户自定义"打开 X 项目 + 启动 Y 服务 + 监控 Z"组合命令）
- [ ] **Linear 多源类型分组**（命令面板结果按"Process / Port / Window / AI / Setting"分组显示）

### [Q-26.C.1] 命令面板借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| Raycast 智能排序 |  |  |
| VS Code Tasks 录制 |  |  |
| Linear 多源分组 |  |  |

**用户回答**: ________________________

---

### [Q-26.C.2] Quicklink 借鉴（Raycast 特色）  协商 [Should]

**背景**: Raycast Quicklink 允许用户预定义"快捷链接"如 `gh {query}` 直接跳 GitHub 搜索。

**选项**: A. 不做 / B. 实现简化版（仅本地命令） / C. 实现完整版（含变量插值 + URL 模板）

**推荐默认**: B 默认

**用户回答**: ________________________

---

### [Q-26.C.3] Superhuman Snippet 借鉴  委托 [Could]

**选项**: A. 不做 / B. 实现 / C. 实现 + AI 扩展（Snippet 可调用 SKILL）

**推荐默认**: A 默认（V1 用户已偏向极简）

**用户回答**: ________________________

---

## D. 拓扑可视化

### 标杆产品的具体做法

| 产品 | 引擎 | 节点上限 | 布局算法 | 交互特色 | 导出 |
|------|----|--------|--------|--------|----|
| **Cytoscape.js** | Canvas + WebGL | 10K+ | force / cose / dagre / breadthfirst / klay 多种 | 手势缩放 + 子图过滤 + 时间动画 | PNG / SVG / JSON |
| **yFiles** | SVG | 100K+（商业） | hierarchic / orthogonal / radial / organic / tree | 智能避让 + 路由 + 标签放置 | PDF / SVG / JSON |
| **Datadog Service Map** | WebGL | 1K+ | 自定义 | 实时数据流 + 健康度色彩 | 无（嵌入式） |
| **Honeycomb Tracing** | SVG | 中等 | 时间瀑布流 | 调用链聚合 | 无 |
| **xyflow (React Flow)** | SVG + Canvas | < 500 | dagre / d3-hierarchy | 拖拽编辑 + minimap | PNG |

### DevHub 当前现状

- NeuralGraphEngine（d3-force，src/renderer/components/monitor/topology/）
- AttachedGraphView 嵌入 PortFocusPanel:534
- TopologyView.tsx 全局视图（独立）
- 无 minimap / 无多布局切换 / 无导出 / 节点上限不明（推断 < 500）

### 推荐借鉴的 3 个做法

- [ ] **Cytoscape.js 多布局切换**（用户可在 force / hierarchic / radial 之间切换）
- [ ] **Datadog 健康度色彩**（节点颜色随 CPU/内存/错误率变化）
- [ ] **xyflow minimap**（右下角小地图 + 当前视图框）

### [Q-26.D.1] 拓扑可视化借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| Cytoscape 多布局切换 |  |  |
| Datadog 健康度色彩 |  |  |
| xyflow minimap |  |  |

**用户回答**: ________________________

---

### [Q-26.D.2] 是否升级到 Cytoscape.js 替换 d3-force  锚定 [Must] 矛盾澄清

**关联**: V1-Q-10.D.1 + V1-§08 用户已选 d3-force

**澄清选项**:
- A. **保留 d3-force**（当前实现）
- B. **升级到 Cytoscape.js**（更强大但学习成本）
- C. **保留 d3-force 用于附属图，新增 Cytoscape.js 用于全局图**（双引擎）
- D. **A + 优化布局算法**（自实现 dagre / radial 补充）

**推荐默认**: C（与 V2-Q-14.B 双重存在协调）

**用户回答**: ________________________

---

### [Q-26.D.3] yFiles 商业引擎评估  委托 [Could]

**背景**: yFiles 是商业最强引擎，价格 $5K+/年。不适合开源 / 个人。

**选项**: A. 不考虑 / B. 仅做兼容接口（未来切换）/ C. 当用户量 > 1000 后评估付费集成

**推荐默认**: A

**用户回答**: ________________________

---

## E. AI Agent 任务编排

### 标杆产品的具体做法

| 产品 | 编排模型 | 节点上限 | 重试策略 | 状态持久化 | 监控面板 |
|------|--------|--------|--------|--------|--------|
| **Temporal.io** | Workflow + Activity | 数万 | 指数退避 + 自定义 | 事件溯源 + DB | Web UI 完整 |
| **Prefect** | Flow + Task | 数千 | 三级重试 + 超时 | Cloud / Self-host | UI + CLI |
| **Apache Airflow** | DAG | 数千 | 重试 + sensor | PostgreSQL | UI 完整 + Gantt |
| **dagster** | Asset + Op | 数千 | 自定义 + Type Check | DB + Cloud | UI + 资产血缘 |
| **n8n** | Workflow + Node | 数百 | 重试 + 错误分支 | DB | UI 拖拽编辑 |

### DevHub 当前现状

- AITaskTracker（4 阶段启发式）
- 无 DAG / 无 Workflow / 无 Activity 抽象 / 无重试 / 无持久化
- V1-Q-7.E 用户期望 CSV 18 列驱动器（V2-§16 深化）

### 推荐借鉴的 3 个做法

- [ ] **Temporal Workflow + Activity 分层**（Workflow = 编排逻辑 / Activity = 业务步骤）
- [ ] **Airflow Gantt 时间轴**（CSV 任务批次的甘特图视图）
- [ ] **n8n 拖拽编辑**（CSV 任务可视化编辑器，避免直接改 CSV）

### [Q-26.E.1] AI 编排借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| Temporal Workflow/Activity 分层 |  |  |
| Airflow Gantt 时间轴 |  |  |
| n8n 拖拽编辑 |  |  |

**用户回答**: ________________________

---

### [Q-26.E.2] dagster 资产血缘（Asset Lineage）借鉴  委托 [Could]

**背景**: dagster 把每个 Task 的输入输出当作"资产"，可视化资产之间的血缘。

**选项**: A. 不做 / B. 简化版（CSV 输出 → 下游任务输入的关系图） / C. 完整版

**推荐默认**: B

**用户回答**: ________________________

---

## F. Watchdog（进程监督）

### 标杆产品的具体做法

| 产品 | 重启策略 | 资源限制 | 心跳协议 | 失败处理 | 平台 |
|------|--------|--------|--------|--------|----|
| **systemd** | always / on-failure / on-abnormal | CPUQuota / MemoryMax | 无（依赖进程退出码） | restart + 退避 | Linux |
| **PM2** | always / max-restarts | max-memory-restart | health check API | restart + log | Node 跨平台 |
| **forever** | always | 无 | 无 | restart 简单 | Node |
| **nodemon** | 文件变化重启 | 无 | 无 | restart | Node 开发 |
| **supervisord** | always / unexpected | 无 | 无 | restart + 通知 | Linux |

### DevHub 当前现状

- 完全未实现 Watchdog（推断由 SystemProcessScanner 定时扫描替代）
- V2-§17 watchdog-engineering-survey 将深化

### 推荐借鉴的 3 个做法

- [ ] **systemd on-failure + 退避**（仅在异常退出时重启，避免无限循环）
- [ ] **PM2 max-memory-restart**（内存超过阈值自动重启 AI 工具）
- [ ] **supervisord 通知钩子**（重启时触发通知 + 审计日志）

### [Q-26.F.1] Watchdog 借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| systemd on-failure + 退避 |  |  |
| PM2 max-memory-restart |  |  |
| supervisord 通知钩子 |  |  |

**用户回答**: ________________________

---

### [Q-26.F.2] 是否引入 PM2 作为依赖  协商 [Should]

**背景**: PM2 npm 包成熟稳定，但增加依赖体积。

**选项**:
- A. **完全自实现**（学习 PM2 思路）
- B. **直接引入 PM2 包作为依赖**
- C. **B + Electron 主进程内嵌 PM2 程序化 API**

**推荐默认**: A（与 V1-Q.K.1 用户偏好"自研可控"一致，参考 V1-Q-10）

**用户回答**: ________________________

---

## G. CLI SHIM（PTY 拦截）

### 标杆产品的具体做法

| 产品 | PTY 引擎 | 输入注入 | 输出过滤 | 颜色支持 | 历史回放 |
|------|--------|--------|--------|--------|--------|
| **node-pty** | C++ libuv | spawn + write | 无内置 | ANSI 透传 | 无 |
| **Warp** | 自研 Rust | 智能输入 + AI 补全 | 内置 search + filter | 完整 ANSI + 256 色 | 完整命令历史 |
| **Tabby** | xterm.js + node-pty | 多 profile | 内置过滤 | 完整 ANSI + truecolor | 仅当前会话 |
| **Wezterm** | Rust 自研 | Lua 脚本 | 强大正则 | truecolor + Image | 完整 |
| **xterm.js** | 仅渲染层 | 上层接 PTY | 上层处理 | ANSI + truecolor | 无 |

### DevHub 当前现状

- 已使用 xterm.js（src/renderer/components/terminal/）
- 未使用 node-pty（需引入）
- V1-Q-10.D.1 + V2-§16/17/18 已涉及 SHIM 路线
- WINDOW_SEND_KEYS 仅键盘事件，非 PTY 输入

### 推荐借鉴的 3 个做法

- [ ] **node-pty + xterm.js 标准组合**（业界主流）
- [ ] **Warp 智能输入**（DevHub 可在 PTY 中追加 SKILL prompt 模板）
- [ ] **Tabby 多 profile**（每个 AI 工具独立 PTY 配置）

### [Q-26.G.1] CLI SHIM 借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| node-pty + xterm.js |  |  |
| Warp 智能输入 |  |  |
| Tabby 多 profile |  |  |

**用户回答**: ________________________

---

### [Q-26.G.2] 是否考虑 Wezterm Lua 脚本扩展  委托 [Could]

**选项**: A. 不考虑 / B. 仅评估 / C. 实现简化版（DevHub Skill 调用）

**推荐默认**: A

**用户回答**: ________________________

---

## H. AI 任务进度检测

### 标杆产品的具体做法（2025-2026）

| 产品 | 检测维度 | 状态机 | 可解释性 | 误报机制 | API |
|------|--------|------|--------|--------|----|
| **LangSmith** | LLM call + tool use + token | run / step / event | 完整 trace + replay | 无（用户标注） | Cloud-only |
| **Langfuse** | LLM + tool + cost | trace / span / observation | trace 树 + score | 用户 score + autoeval | Self-host + Cloud |
| **Arize Phoenix** | embedding + drift + feedback | trace / span | embedding viz | drift detection | Self-host |
| **DeepEval** | LLM 评估指标 | evaluation run | 多种 metric | benchmark | 库 |
| **OpenAI Codex (CLI)** | 自身 stdout | task / subtask | 文字状态 | 无 | CLI |
| **Claude Code** | 自身 stdout + tool calls | task / step | TodoWrite + 实时 | 无 | CLI |

### DevHub 当前现状

- 启发式 6 信号融合（COMPILE / COMPLETION / ERROR / PROMPT pattern）
- 无 stdout 真实读取 / 无 trace 树 / 无可解释性面板
- V2-§15 ai-detection-zero-error 已深化路线

### 推荐借鉴的 3 个做法

- [ ] **Langfuse trace 树 + 可解释性**（每个状态变化都能追溯到信号源）
- [ ] **Claude Code TodoWrite 解析**（直接读取 AI 工具的待办列表，绕过启发式）
- [ ] **DeepEval 用户 score 反馈循环**（用户标注"此次报错正确/错误"形成训练数据）

### [Q-26.H.1] AI 进度检测借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| Langfuse trace 树 |  |  |
| Claude Code TodoWrite 解析 |  |  |
| DeepEval 用户 score |  |  |

**用户回答**: ________________________

---

### [Q-26.H.2] Arize 漂移检测借鉴  委托 [Could]

**背景**: Arize 检测 LLM 输出 embedding 漂移，可识别"模型行为异常"。

**选项**: A. 不做（过重） / B. 简化版（仅检测同一 prompt 多次输出的相似度）/ C. 完整版

**推荐默认**: A

**用户回答**: ________________________

---

## I. 主题系统多维度差异

### 标杆产品的具体做法

| 产品 | 主题数 | 维度 | 切换粒度 | 自定义 | 量化差异 |
|------|------|----|--------|------|--------|
| **Linear** | 4（Default/Light/Dark/High Contrast） | 颜色 + 对比度 | 全局 | 无 | 仅颜色 |
| **Vercel** | 3（System/Light/Dark） | 颜色 + 字体 | 全局 + 编辑器 | 编辑器主题独立 | 仅颜色 |
| **Stripe** | 2（Light/Dark） | 颜色 + 微动效 | 全局 | 无 | 颜色 + 微动效 |
| **Mantine** | 多（库级别） | 颜色 + 圆角 + 字体 + 间距 | 组件级 | 全部可控 | 全维度可量化 |
| **shadcn** | 多（社区） | 颜色 + 圆角 + 字体 | 组件级 + CSS 变量 | 全部可控 | 颜色 + 圆角可量化 |
| **VS Code** | 数百（社区） | 颜色 + 图标 | 编辑器 + UI | 完整 JSON | 仅颜色 |

### DevHub 当前现状

- 4 维 token（Palette / Density / RadiusFamily / MotionLevel）
- 6 预设主题（constructivism / modern-light / warm-light / cyberpunk / swiss / dark / light）
- 用户最新反馈："切换依然只是换色"
- V2-§20 theme-quantitative-diff 已深化

### 推荐借鉴的 3 个做法

- [ ] **Mantine 全维度可量化**（每对主题在 6 维上的 px/ms 差异写入 spec）
- [ ] **shadcn CSS 变量**（用户可手动微调单个变量）
- [ ] **Stripe 微动效**（切换主题时各元素先后动画过渡）

### [Q-26.I.1] 主题系统借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| Mantine 全维度量化 |  |  |
| shadcn CSS 变量微调 |  |  |
| Stripe 微动效过渡 |  |  |

**用户回答**: ________________________

---

### [Q-26.I.2] VS Code 数百主题生态借鉴  委托 [Could]

**关联**: V2-Q-25.F.1 主题市场

**选项**: A. 不做 / B. 中期开 Theme Pack / C. 长期模仿 VS Code 生态规模

**推荐默认**: B

**用户回答**: ________________________

---

## J. Process Hacker / Process Explorer 扩展

### 标杆产品的具体做法

| 产品 | 进程树 | 句柄追踪 | 网络连接 | DLL 模块 | 资源监控 |
|------|------|--------|--------|--------|--------|
| **Process Hacker** | 树 + 颜色编码 | 完整句柄 | 完整 | 完整 | 内置 + 历史 |
| **System Informer** | 同 PH（继承） | 完整 | 完整 | 完整 | 内置 |
| **Process Explorer (Sysinternals)** | 树 + tooltip | 完整 | 通过 TCPView | 完整 | 内置 |
| **Activity Monitor (macOS)** | 树 + 平铺 | 简化 | 简化 | 简化 | 内置 |

### DevHub 当前现状

- SystemProcessScanner（WMIC + Get-Process）
- ProcessDetailPanel 5-Tab（基础/资源/网络/环境/模块）
- 用户反馈"卡片状态查资源详情显示权限不足"
- 句柄追踪未实现（推断 V1-Q-4.B 已涉及）

### 推荐借鉴的 3 个做法

- [ ] **Process Hacker 颜色编码**（按服务/系统/用户/AI工具不同颜色）
- [ ] **Process Explorer tooltip**（hover 进程显示完整 cmdline + 启动时间 + 描述）
- [ ] **Sysinternals 句柄搜索**（"哪个进程占了文件 X / 端口 Y"反向查询）

### [Q-26.J.1] Process 监控借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| Process Hacker 颜色编码 |  |  |
| Process Explorer tooltip |  |  |
| Sysinternals 句柄反查 |  |  |

**用户回答**: ________________________

---

### [Q-26.J.2] DLL 模块追踪深度  协商 [Should]

**选项**: A. 不做 / B. 仅显示数量 / C. 完整列表 / D. C + 已加载 DLL 反查

**推荐默认**: C

**用户回答**: ________________________

---

## K. 图标库 + AI 工具品牌 logo

### 标杆产品的具体做法

| 库 | 数量 | 风格 | License | 品牌覆盖 | 包大小 |
|---|----|----|--------|--------|------|
| **lucide-react** | 1400+ | 24x24 stroke | ISC | 无品牌 | 中（按需 tree-shake） |
| **phosphor-react** | 1200+ | 6 weight 可选 | MIT | 无品牌 | 中 |
| **iconoir** | 1500+ | 24x24 stroke + solid | MIT | 无品牌 | 中 |
| **simple-icons** | 3000+ | 品牌 logo 单色 SVG | CC0 | 全品牌 | 小 |
| **react-icons** | 30K+ | 多库聚合 | MIT (各库) | 部分 | 大 |

### DevHub 当前现状

- 已使用 lucide-react（src/renderer/components/icons/）
- 自绘部分 AI 工具品牌 logo
- 与 V2-Q-24.A.1 商标合规需协调

### 推荐借鉴的 3 个做法

- [ ] **lucide + simple-icons 双库**（系统图标 lucide / 品牌 logo simple-icons CC0）
- [ ] **phosphor 6 weight**（按密度档自动切换 light / regular / bold 重量）
- [ ] **iconoir solid 变体**（活跃态用 solid，非活跃用 stroke 区分）

### [Q-26.K.1] 图标库借鉴选择  锚定 [Must]

| 做法 | 引入 | 优先级（1-3） |
|------|----|------------|
| lucide + simple-icons 双库 |  |  |
| phosphor 6 weight |  |  |
| iconoir solid 变体 |  |  |

**用户回答**: ________________________

---

### [Q-26.K.2] 自绘 AI 工具 logo 是否替换为 simple-icons  协商 [Should]

**关联**: V2-Q-24.A.1 商标合规

**选项**:
- A. **保留自绘**（不与厂商品牌完全一致，规避商标）
- B. **全部替换为 simple-icons**（CC0 + 与厂商一致）
- C. **B + 显式声明 fair use**

**推荐默认**: C

**用户回答**: ________________________

---

### [Q-26.K.3] react-icons 聚合库是否引入  委托 [Could]

**背景**: react-icons 包含 30K+ 图标但体积大，多库聚合。

**选项**: A. 不引入 / B. 仅按需引入特定 / C. 完整引入

**推荐默认**: A（保持当前 lucide 极简）

**用户回答**: ________________________

---

## L. 市场对标小结（开放性问题）

### Q-26.L.1
对标完成后，您觉得 DevHub 在 11 个维度中哪 3 个**已经业界领先**？哪 3 个**差距最大**？

**用户回答**: ________________________

---

### Q-26.L.2
若必须舍弃 5 个借鉴做法（资源有限），您会舍弃哪 5 个？

**用户回答**: ________________________

---

### Q-26.L.3
您希望 DevHub 哪 3 个维度做到"独树一帜"（业界没有的特色）？

**用户回答**: ________________________

---

### Q-26.L.4
上述对标矩阵之外，您还希望对标哪些产品？（自由填写产品名 + 对标理由）

**用户回答**: ________________________

---

### Q-26.L.5
对标矩阵的"借鉴排序"是否应纳入 R8 PRD 必含章节？还是仅作为内部参考？

**用户回答**: ________________________
