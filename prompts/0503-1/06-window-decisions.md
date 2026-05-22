# 06 — 窗口模块决策（提炼版）

> **派生自**: `prompts/0503/06-window-module-survey.md`
> **核心痛点**: 「AI 进程探测必须准确无误」
> **R8.A 优先级**: AI 任务相关 → R8.C；窗口操作补齐 → R8.A

---

## A. 视图模式（[Q-6.A] [ACCEPT]）

### A.1 视图模式（[Q-6.A.1]）
**用户回答**: E — 卡片 + 列表 + 缩略图墙

3 视图共存:
- **Card**: 类当前监控 Tab
- **List**: 紧凑高密度
- **Thumbnail Wall**: 每窗口截图缩略 + 操作按钮（类 Mission Control）

### A.2 窗口关系图独立模式（[Q-6.A.2] [ACCEPT]）
**用户回答**: C — 命令面板触发临时浮层（不做独立 Tab）

---

## B. AI 工具实例消歧（最关键）

### B.1 多实例识别（[Q-6.B.1] [ACCEPT]）
**用户回答**: 全选 + 多信号融合（3 个匹配即同实例）

8 个识别维度:
1. 进程 PID
2. 窗口 hwnd
3. EXE 路径 + 启动时间
4. 工作目录（cwd）+ EXE
5. 窗口标题模式匹配
6. 命令行参数 hash
7. 用户手动 alias
8. AI 工具自上报（文件 / 环境变量 / 进程标记）

**融合规则**: 任意 3 个维度匹配即认为是同一实例

### B.2 alias 管理（[Q-6.B.2] [ACCEPT]）
**用户回答**: D — cwd 自动 + 用户偏好覆盖 + AI 自检测

### B.3 alias 持久化（[Q-6.B.3] [ACCEPT]）
**用户回答**: D — 持久化 + 可清空 + 导入导出

### B.4 通知是否携带 alias（[Q-6.B.4] [ACCEPT]）
**用户回答**: A 默认 + C fallback
- 默认携带 displayName（"[Claude Code-devhub] 任务完成"）
- 未命名实例 fallback 到 PID/cwd

---

## C. 窗口分组

### C.1 分组 key（[Q-6.C.1] [CHANGE]）
**用户回答**: **D**（默认是 C）
- 三元组 (exe_path, title_pattern, project_cwd) + alias + **启动顺序索引**

→ 多实例下"启动顺序"是关键稳定 key（Claude Code #1 / #2 / #3 不会因 hwnd 重启失效）

### C.2 分组 UI（[Q-6.C.2] [ACCEPT]）
**用户回答**: D — 全选
- 顶部标签栏
- 左侧分组栏
- 拖拽分组

### C.3 自动分组建议（[Q-6.C.3] [ACCEPT]）
**用户回答**: D — EXE + cwd 自动建议

### C.4 批量操作（[Q-6.C.4] [ACCEPT]）
**用户回答**: 全选

7 项批量操作:
- 一键 focus 全部
- 一键 minimize 全部
- 一键 close 全部（确认）
- 一键 always-on-top 全部
- 一键 screenshot 全部
- 一键 rename 全部（按模板）
- **一键 inject text 全部**（同时给所有 AI 工具发同条提示）— 慎用

---

## D. 窗口操作

### D.1 单窗口操作（[Q-6.D.1] [ACCEPT]）
**用户回答**: 全选

#### 已实现（5 项）
- focus / close / rename / screenshot

#### 缺失（必须补齐）
- **always-on-top** — R8.A 必须补
- minimize / restore / maximize
- move / resize（指定坐标尺寸）
- snap to side（左半屏 / 右半屏 / 四象限）
- transparency（0-100%）
- virtual-desktop move（Win11 桌面 N）
- inject text
- send key（Ctrl+S 等组合键）
- OCR 屏幕（**默认关闭**，10.D.3 已确认）
- find element（UIA / Win32 找按钮）

### D.2 inject text 实现（[Q-6.D.2] [CHANGE]）
**用户回答**: F + E + 「**参照市面上 AI CLI 的 inject 最佳实践，如有冲突作出深刻判断后抉择**」

实现栈:
- **F. SendInput + UIA 混合**（GUI 窗口）
- **E. node-pty 直接控制**（终端窗口）
- **市场对标**: Spec 编写时必须研究：
  - Codex CLI 的 STDIN 注入方式
  - Claude Code 的 stream-json 输入
  - Gemini CLI 的 piped input
  - Cursor 的 IPC inject
  - 已有 Robotjs / nut-tree / @nut-tree-fork 框架

→ Spec 须呈现"市场最佳实践对比 + 选型决策"章节

### D.3 注入安全（[Q-6.D.3] [ACCEPT]）
**用户回答**: B + C + D
- 默认 B：首次注入需确认 + 信任后 1h 记忆
- C：白名单窗口免确认
- D：仅 CSV 任务模式启用免确认

### D.4 截图存储（[Q-6.D.4] [ACCEPT]）
**用户回答**: C — 默认只读 Buffer + 任务录像模式落盘

---

## E. 跨虚拟桌面 / 跨屏

### E.1 虚拟桌面（[Q-6.E.1] [ACCEPT]）
**用户回答**: D — 标识在桌面 N + 跨桌面 focus

### E.2 多屏（[Q-6.E.2] [ACCEPT]）
**用户回答**: D — 标注屏幕 + 移到主/副屏

---

## F. 窗口历史

### F.1 出现/消失历史（[Q-6.F.1] [ACCEPT]）
**用户回答**: B — 仅当前会话

### F.2 标题变化历史（[Q-6.F.2] [ACCEPT]）
**用户回答**: B — 仅当前会话

→ 用于 AI 任务感测信号源

---

## G. 关系视图入口

### G.1 入口（[Q-6.G.1] [ACCEPT]）
**用户回答**: B + C — 卡片角标 + 悬浮卡片内嵌

---

## H. 自由填写

### H.1 自动注入最强用例（[Q-6.H.1]）
**用户原话**: 「**CSV 任务批次每条任务自动写入对应的 Claude Code 窗口**」

→ Spec: CSV → DAG → 窗口路由 → inject 全链路必须打通

### H.2 窗口启动/关闭通知（[Q-6.H.2]）
**用户回答**: 全部

→ 后期可降级，但默认全弹

### H.3 必须明确（[Q-6.H.3]）
**用户原话**: 「**对于 AI 进程的探测必须要做到准确无误**」

→ R8.A 必须包含 AI 探测准确性"用户感知断言"
→ 信号融合算法必须可观测（DevObservabilityPanel）

---

## I. PRD 信号

1. **AI 实例消歧 8 维融合**：核心引擎，与 04 / 07 共享
2. **启动顺序索引**：分组 key 多了一维（用户改默认）
3. **always-on-top R8.A 必须补齐**
4. **inject 必须做市场对标**：Spec 必须有对比章节
5. **CSV → 窗口 inject 全链路是关键用例**
6. **AI 探测"准确无误"是验收红线**：失败将触发 R8.A 暂停
7. **OCR 接口保留但默认关**
8. **缩略图墙是 Mission Control 风格**
