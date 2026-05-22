# 10 — 集成库选型需求表

> **填写时长**: 约 10–15 分钟
> **重要程度**: 决定 R8 实现路径与工作量
> **依赖**: 完成所有功能模块
> **核心原则**: **集成而非自研** — 用户已要求"参照目前有的库、模块、项目，做一个集成化的实现"

---

## A. 进程信息采集

### [Q-10.A.1] 进程信息核心库  锚定 [Must]

**当前**: PowerShell `Get-CimInstance Win32_Process` + 自定义包装。

**选项**:
- A. **保留 PowerShell 路径**（已实现）
- B. **wmi-client**（Node 直接调 WMI，避免 child_process）
- C. **node-windows**（包装 sc.exe / wmic 等）
- D. **systeminformation**（跨平台，但 Windows 字段较少）
- E. **ps-list**（轻量但字段少）
- F. **A + B 混合**（高频用 wmi-client，深度查用 PowerShell 兜底）

**推荐默认**: F

**影响范围**: 选 F 可显著降低 PowerShell 子进程数（R6-P2.1 主因之一）

**用户回答**: _________F_______________

---

### [Q-10.A.2] 子进程强制 kill  锚定 [Must]

**当前**: R7 spec/03 提议引入 tree-kill。

**选项**:
- A. **tree-kill**（成熟，递归杀进程树）
- B. **taskkill /F /T**（Windows 原生，Shell 调用）
- C. **A + B 混合**

**推荐默认**: A 默认 + B 兜底

**用户回答**: _______________A 默认 + B 兜底，使用taskkill务必要谨慎，一次一条命令杀一个特定的进程_________

---

### [Q-10.A.3] 进程时间序列与 Sparkline  委托 [Could]

**选项**:
- A. 自实现 ring buffer
- B. **systeminformation** 自带历史
- C. 引入 [react-sparklines] 渲染

**推荐默认**: A 后端 + C 前端

**用户回答**: ____________A 后端 + C 前端____________

---

## B. 窗口管理

### [Q-10.B.1] Windows 窗口枚举与控制  锚定 [Must]

**当前**: 自定义 WindowManager + 部分 Win32 调用。

**选项**:
- A. **保留自实现**
- B. **active-win**（仅取活动窗口，不全）
- C. **node-window-manager**（成熟，支持 enumerate / focus / move）
- D. **koffi**（FFI，直接调 user32.dll，最灵活）
- E. **win32-displayconfig**（多屏与 DPI）
- F. **C + D + E 组合**

**推荐默认**: F

**影响范围**: F 提供完整窗口控制能力 + 跨虚拟桌面

**用户回答**: _________F_______________

---

### [Q-10.B.2] inject text / send key  锚定 [Must]

**关联 [Q-6.D.2]**.

**选项**:
- A. **robotjs**（成熟，跨平台，需 native build）
- B. **nut.js**（替代 robotjs，更现代）
- C. **koffi 直接调 SendInput**
- D. **node-pty**（仅终端窗口）
- E. **B + C + D 组合**

**推荐默认**: E

**用户回答**: _________E_______________

---

### [Q-10.B.3] UI Automation（语义级元素查找）  委托 [Could]

**选项**:
- A. **不实现**
- B. **uiautomation-node**（社区包）
- C. **koffi 直接调 UIA COM**
- D. **PowerShell + Get-WindowText**

**推荐默认**: B（如不可用则 C）

**用户回答**: _________B（如不可用则 C）_______________

---

### [Q-10.B.4] 窗口截图  协商 [Should]

**当前**: 已实现（windowHandlers.ts:346）。

**选项**:
- A. **保留现有实现**
- B. **screenshot-desktop**（跨平台）
- C. **electron desktopCapturer**（Electron 原生）

**推荐默认**: A

**用户回答**: _________A_______________

---

### [Q-10.B.5] OCR  委托 [Could]

**选项**:
- A. **不实现**
- B. **tesseract.js**（纯 JS，离线，慢）
- C. **node-tesseract-ocr**（包装 tesseract CLI，需安装）
- D. **Azure Computer Vision API**（云端，需 key）

**推荐默认**: B（默认）+ D（用户配置）

**用户回答**: _________A_______________

---

## C. AI CLI 集成

### [Q-10.C.1] CLI 进程接管  锚定 [Must]

**关联 [Q-7.A.2] 中"stdout/stderr 解析"**.

**选项**:
- A. **node-pty**（终端式接管，最佳）
- B. **execa**（spawn 增强）
- C. **child_process**（标准）
- D. **A + B 混合**（终端用 pty，简单调用用 execa）

**推荐默认**: D

**用户回答**: ____________D____________

---

### [Q-10.C.2] AI 输出 stream 解析  锚定 [Must]

**选项**:
- A. **逐行解析**（split lines）
- B. **JSON 流解析**（newline-delimited JSON / SSE）
- C. **自定义协议**（DevHub 制定 codex-shim 协议）
- D. **A + B + C**（按工具自动选择）

**推荐默认**: D

**用户回答**: ____________D____________

---

### [Q-10.C.3] 提示词模板引擎  协商 [Should]

**关联 [Q-7.D.1] SKILL 库**.

**选项**:
- A. **handlebars**
- B. **mustache**
- C. **eta**
- D. **liquid**
- E. **简单 ${} 插值（自实现）**
- F. **使用 Anthropic Agent Skills 官方格式**

**推荐默认**: E + F（简单插值起步 + 兼容官方）

**用户回答**: __________E + F（简单插值起步 + 兼容官方）______________

---

## D. 任务编排与队列

### [Q-10.D.1] 任务队列引擎  锚定 [Must]

**关联 [Q-7.E] CSV 驱动**.

**选项**:
- A. **bullmq**（Redis 依赖，但功能强）
- B. **bree**（cron + 并发）
- C. **graphlib + 自实现**（轻量）
- D. **node-resque**
- E. **better-queue**（无外部依赖，本地 SQLite）

**推荐默认**: E + C（轻量本地 + DAG 拓扑）

**用户回答**: ____________E + C（轻量本地 + DAG 拓扑）____________

---

### [Q-10.D.2] DAG 拓扑排序  委托 [Could]

**选项**:
- A. **graphlib**（成熟）
- B. **toposort**
- C. **自实现**（< 50 LoC）

**推荐默认**: A

**用户回答**: _________A_______________

---

### [Q-10.D.3] CSV 解析  协商 [Should]

**选项**:
- A. **papaparse**（最流行）
- B. **csv-parse**（node 标准）
- C. **fast-csv**

**推荐默认**: A

**用户回答**: _________A_______________

---

### [Q-10.D.4] 文件监听  协商 [Should]

**选项**:
- A. **chokidar**（成熟）
- B. **node fs.watch**（原生，跨平台问题）
- C. **fast-glob + 轮询**

**推荐默认**: A

**用户回答**: ____A____________________

---

## E. 拓扑图渲染

### [Q-10.E.1] 图引擎  锚定 [Must]

**当前**: NeuralGraphEngine（基于 d3-force）已实现。

**选项**:
- A. **保留 NeuralGraphEngine**（自研）
- B. **@xyflow/react (React Flow)**（成熟，最强）
- C. **cytoscape.js**（专业图分析，复杂）
- D. **sigma.js**（大规模优化）
- E. **A + B 双引擎**（小图 A，大图 B）

**推荐默认**: A 默认 + B 备选（用户可切换）

**用户回答**: _______________A 默认 + B 备选（用户可切换）_________

---

### [Q-10.E.2] 布局算法补充  委托 [Could]

**当前**: d3-force（力导向）。

**选项**:
- A. **保留 d3-force**
- B. **+ dagre**（层级）
- C. **+ elkjs**（精确分层）
- D. **+ webcola**（约束布局）
- E. **B + C 全部**

**推荐默认**: E

**用户回答**: _______________E_________

---

### [Q-10.E.3] 时序流程图  委托 [Could]

**选项**:
- A. **mermaid**（声明式，简单）
- B. **vis-timeline**（交互强）
- C. **timelinejs**（前端）

**推荐默认**: A 默认 + B 加分项

**用户回答**: ___________A 默认 + B 加分项_____________

---

## F. UI 框架与组件

### [Q-10.F.1] 命令面板  锚定 [Must]

**关联 [Q-2.B.4]**.

**选项**:
- A. **cmdk**（Vercel，最流行）
- B. **kbar**
- C. **react-cmdk**
- D. **自实现**

**推荐默认**: A

**用户回答**: _________A_______________

---

### [Q-10.F.2] 可拖拽分栏  锚定 [Must]

**关联 [Q-2.A.1]**.

**选项**:
- A. **react-resizable-panels**（最流行）
- B. **allotment**（VSCode 同款）
- C. **react-mosaic**（VSCode 风重型）

**推荐默认**: A

**用户回答**: ____________A____________

---

### [Q-10.F.3] Drawer 组件  协商 [Should]

**选项**:
- A. **vaul**（现代，移动端友好）
- B. **radix-ui dialog**（无样式，自定义）
- C. **react-aria**
- D. **自实现**

**推荐默认**: B

**用户回答**: ______________B__________

---

### [Q-10.F.4] 可拖拽仪表板  委托 [Could]

**选项**:
- A. **react-grid-layout**（最流行）
- B. **dnd-kit + 自布局**

**推荐默认**: A

**用户回答**: _________A_______________

---

### [Q-10.F.5] 表格 / 虚拟列表  协商 [Should]

**当前**: 进程列表性能问题潜在风险（万行进程）。

**选项**:
- A. **react-window**
- B. **react-virtualized**
- C. **tanstack-table + virtual**
- D. **自实现**

**推荐默认**: C

**用户回答**: ____________C____________

---

### [Q-10.F.6] 表单  委托 [Could]

**选项**:
- A. **react-hook-form**
- B. **formik**
- C. **conform**

**推荐默认**: A

**用户回答**: ____________A____________

---

### [Q-10.F.7] 时间格式化  委托 [Could]

**选项**:
- A. **date-fns**
- B. **dayjs**
- C. **luxon**

**推荐默认**: A

**用户回答**: _____A___________________

---

## G. 状态管理

### [Q-10.G.1] 是否新增状态库  协商 [Should]

**当前**: zustand。

**选项**:
- A. **保持 zustand**（不引入新库）
- B. **+ jotai**（细粒度原子）
- C. **+ valtio**（proxy 风格）
- D. **+ xstate**（状态机）

**推荐默认**: A 主流 + D 仅在 AI 状态机使用（[Q-7.A.4] 三层状态机）

**用户回答**: _________A 主流 + D 仅在 AI 状态机使用_______________

---

## H. 性能与监控

### [Q-10.H.1] 内存泄漏检测  委托 [Could]

**选项**:
- A. **不引入**
- B. **chrome devtools heap snapshot**（手动）
- C. **memlab（Meta 出品）**
- D. **clinic.js**

**推荐默认**: B

**用户回答**: _________B_______________

---

### [Q-10.H.2] 渲染性能监控  委托 [Could]

**选项**:
- A. **why-did-you-render**
- B. **react-scan**
- C. 不引入

**推荐默认**: B（开发模式启用）

**用户回答**: _________B_______________

---

## I. 测试

### [Q-10.I.1] E2E 测试框架  锚定 [Must]

**当前**: Playwright + Electron。

**选项**: A. 保持 / B. 切到 spectron / C. 切到 wdio

**推荐默认**: A

**用户回答**: _________A_______________

---

### [Q-10.I.2] 单测框架  协商 [Should]

**当前**: vitest。

**选项**: A. 保持 / B. jest / C. node:test

**推荐默认**: A

**用户回答**: ______A__________________

---

### [Q-10.I.3] 视觉回归测试  委托 [Could]

**选项**:
- A. 不做
- B. **playwright + screenshot diff**
- C. **chromatic**（云端）
- D. **percy**

**推荐默认**: B（本地）

**用户回答**: _________B_______________

---

## J. 集成库小结

**Q-10.J.1**: 上述所有候选库中，您有强烈反对引入的？请列：____________没有____________

**Q-10.J.2**: 您有强烈倾向使用的特定库（清单未列出的）？请列：______________没有__________

**Q-10.J.3**: 您是否同意"集成优先于自研"原则？（A. 同意 / B. 仅核心模块自研，其他集成 / C. 不同意）：____________ B. 仅核心模块自研，其他集成____________

**Q-10.J.4**: 上述以外，集成库还有什么必须明确的？自由填写：________________________
