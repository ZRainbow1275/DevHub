# 10 — 集成库选型决策（提炼版）

> **派生自**: `prompts/0503/10-integration-libraries-survey.md`
> **R8.A 优先级 #1**（地基）
> **核心原则**: 「**仅核心模块自研，其他集成**」（[Q-10.J.3]）

---

## A. 进程信息

### A.1 核心库（[Q-10.A.1] [CHANGE]）
**用户回答**: **F** — wmi-client + PowerShell 混合（默认是 F，但用户明确选了 F）

- 高频用 wmi-client（Node 直接调 WMI）
- 深度查用 PowerShell 兜底
- 显著降低 PowerShell 子进程数（R6-P2.1 主因之一）

### A.2 子进程强制 kill（[Q-10.A.2] [EXTEND]）
**用户原话**: 「A 默认 + B 兜底，**使用 taskkill 务必要谨慎，一次一条命令杀一个特定的进程**」

- A. tree-kill 默认（递归杀进程树）
- B. taskkill /F /T 兜底
- **铁律**: taskkill 调用只能一次一条命令杀一个特定 PID，禁止批量杀
- Spec 编写时必须实现"显式 PID 校验"封装

### A.3 时间序列 Sparkline（[Q-10.A.3] [ACCEPT]）
**用户回答**: A 后端 + C 前端
- 后端：自实现 ring buffer
- 前端：react-sparklines

---

## B. 窗口管理

### B.1 窗口枚举与控制（[Q-10.B.1] [ACCEPT]）
**用户回答**: F — node-window-manager + koffi + win32-displayconfig 组合

- node-window-manager：enumerate / focus / move
- koffi：FFI 直接调 user32.dll（最灵活）
- win32-displayconfig：多屏与 DPI

### B.2 inject text / send key（[Q-10.B.2] [ACCEPT]）
**用户回答**: E — nut.js + koffi SendInput + node-pty

- nut.js（替代 robotjs，更现代）
- koffi 直接调 SendInput（Win32 兜底）
- node-pty（终端窗口）

### B.3 UI Automation（[Q-10.B.3] [ACCEPT]）
**用户回答**: B（如不可用则 C）— uiautomation-node 优先 / koffi UIA COM 兜底

### B.4 窗口截图（[Q-10.B.4] [ACCEPT]）
**用户回答**: A — 保留现有实现（windowHandlers.ts:346）

### B.5 OCR（[Q-10.B.5] [CHANGE]）
**用户回答**: **A — 不实现**（默认是 B+D）

→ R8.A 不集成任何 OCR 库
→ 但保留 OCR 接口（07.A.2 的"截图差异+OCR"信号源待 R9 启用）
→ 06.D.1 列表中的"OCR 屏幕"操作 = 占位 disabled 按钮

---

## C. AI CLI 集成

### C.1 进程接管（[Q-10.C.1] [ACCEPT]）
**用户回答**: D — node-pty + execa 混合
- 终端用 pty
- 简单调用用 execa

### C.2 stream 解析（[Q-10.C.2] [ACCEPT]）
**用户回答**: D — 全部支持
- 逐行解析
- JSON 流（NDJSON / SSE）
- 自定义 codex-shim 协议
- 按工具自动选择

### C.3 提示词模板引擎（[Q-10.C.3] [ACCEPT]）
**用户回答**: E + F — 简单 ${} 插值 + 兼容 Anthropic Agent Skills 官方格式

---

## D. 任务编排与队列

### D.1 队列引擎（[Q-10.D.1] [ACCEPT]）
**用户回答**: E + C — better-queue（本地 SQLite）+ graphlib（DAG 拓扑）

- better-queue：无外部依赖，本地 SQLite 持久化
- graphlib：DAG 拓扑排序

### D.2 DAG 拓扑（[Q-10.D.2] [ACCEPT]）
**用户回答**: A — graphlib

### D.3 CSV 解析（[Q-10.D.3] [ACCEPT]）
**用户回答**: A — papaparse（最流行）

### D.4 文件监听（[Q-10.D.4] [ACCEPT]）
**用户回答**: A — chokidar

---

## E. 拓扑图渲染

### E.1 图引擎（[Q-10.E.1] [ACCEPT]）
**用户回答**: A 默认 + B 备选
- A. 保留 NeuralGraphEngine（自研，d3-force）
- B. @xyflow/react 备选（用户可切换）

### E.2 布局算法（[Q-10.E.2] [ACCEPT]）
**用户回答**: E — 全部
- d3-force（力导向）
- dagre（层级）
- elkjs（精确分层）

### E.3 时序流程图（[Q-10.E.3] [ACCEPT]）
**用户回答**: A 默认 + B 加分项 — mermaid + vis-timeline

---

## F. UI 框架

### F.1 命令面板（[Q-10.F.1] [ACCEPT]）
**用户回答**: A — cmdk（Vercel 出品）

### F.2 可拖拽分栏（[Q-10.F.2] [ACCEPT]）
**用户回答**: A — react-resizable-panels

### F.3 Drawer（[Q-10.F.3] [ACCEPT]）
**用户回答**: B — radix-ui dialog（无样式，自定义）

### F.4 可拖拽仪表板（[Q-10.F.4] [ACCEPT]）
**用户回答**: A — react-grid-layout

### F.5 表格 / 虚拟列表（[Q-10.F.5] [ACCEPT]）
**用户回答**: C — tanstack-table + virtual

### F.6 表单（[Q-10.F.6] [ACCEPT]）
**用户回答**: A — react-hook-form

### F.7 时间格式化（[Q-10.F.7] [ACCEPT]）
**用户回答**: A — date-fns

---

## G. 状态管理（[Q-10.G.1] [ACCEPT]）

**用户回答**: A 主流 + D 仅在 AI 状态机使用

- 默认 zustand
- xstate 仅用于 [Q-7.A.4] 三层状态机

---

## H. 性能与监控

### H.1 内存泄漏检测（[Q-10.H.1] [ACCEPT]）
**用户回答**: B — chrome devtools heap snapshot（手动）

### H.2 渲染性能监控（[Q-10.H.2] [ACCEPT]）
**用户回答**: B — react-scan（开发模式启用）

---

## I. 测试

### I.1 E2E（[Q-10.I.1] [ACCEPT]）
**用户回答**: A — Playwright（保持）

### I.2 单测（[Q-10.I.2] [ACCEPT]）
**用户回答**: A — vitest（保持）

### I.3 视觉回归（[Q-10.I.3] [ACCEPT]）
**用户回答**: B — playwright + screenshot diff（本地）

---

## J. 自由填写

### J.1 强烈反对引入的库（[Q-10.J.1]）
**用户回答**: 没有

### J.2 强烈倾向（清单未列）（[Q-10.J.2]）
**用户回答**: 没有

### J.3 集成 vs 自研原则（[Q-10.J.3] [CHANGE→NARROW]）
**用户原话**: 「**B. 仅核心模块自研，其他集成**」

→ 默认是 A 同意（全集成），用户改为 B（核心保留自研）

**核心模块清单**（不强制集成，沿用自研）:
- NeuralGraphEngine（拓扑图）
- AITaskTracker（信号融合）
- WindowManager（窗口三元组指纹）
- ProcessUnifiedViewModel（进程数据层）
- 这些模块允许引入辅助库，但核心架构保留

---

## K. R8 总集成清单（PRD 编撰时直接引用）

### K.1 必装（生产依赖）

| 用途 | 库 | 备注 |
|------|----|----|
| 进程 WMI | wmi-client | 替代 PowerShell 高频路径 |
| 进程 kill | tree-kill + taskkill 谨慎封装 | 一次一 PID |
| Sparkline | react-sparklines | 前端 |
| 窗口 | node-window-manager + koffi + win32-displayconfig | 三件套 |
| 输入注入 | nut.js + node-pty | 加 koffi SendInput 兜底 |
| UIA | uiautomation-node | koffi 兜底 |
| CLI 接管 | node-pty + execa | |
| CSV | papaparse | |
| 文件监听 | chokidar | |
| 任务队列 | better-queue + graphlib | 本地 SQLite |
| 图引擎 | NeuralGraphEngine（保留）+ @xyflow/react（备选） | |
| 布局 | d3-force + dagre + elkjs | |
| 时序图 | mermaid（默认）+ vis-timeline（加分） | |
| 命令面板 | cmdk | |
| 分栏 | react-resizable-panels | |
| Drawer | radix-ui dialog | |
| 仪表板 | react-grid-layout | |
| 表格 | tanstack-table + tanstack-virtual | |
| 表单 | react-hook-form | |
| 时间 | date-fns | |
| 状态机 | xstate（仅 AI 状态机） | |
| 校验 | zod（继承） | |

### K.2 开发依赖

| 用途 | 库 |
|------|----|
| 渲染检测 | react-scan |
| E2E | Playwright |
| 单测 | vitest |
| 视觉回归 | Playwright screenshot diff |
| 内存检测 | chrome devtools 手动 |

### K.3 不引入

- OCR（默认关闭）
- 任何遥测 SDK（Sentry / Datadog / PostHog / Mixpanel）
- 任何云服务 SDK
- robotjs（用 nut.js 替代）

---

## L. PRD 信号

1. **集成库引入是 R8.A 的地基**：所有后续模块都依赖
2. **wmi-client 是关键**：解决 R6-P2.1 PowerShell 内存爆炸
3. **taskkill 必须谨慎封装**：一次一 PID，不允许批量
4. **OCR 接口预留但默认关**
5. **核心模块保留自研**：NeuralGraphEngine / AITaskTracker / WindowManager
6. **xstate 仅用于 AI 状态机**：不全局引入，避免架构重构
7. **inject 三件套**：nut.js（GUI）+ node-pty（终端）+ koffi SendInput（兜底）
