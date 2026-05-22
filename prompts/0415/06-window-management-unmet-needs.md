# O1/O2/O3 — 窗口管理：四轮反馈仍未实现的核心需求

> 日期: 2026-04-15
> 严重性: **P0-Critical**（用户第 5 次反馈"多次始终要求的功能依旧完全没有实现"）
> R1-R4 关联: R1 PRD §2.1/§2.2/§2.3、R4 `prompts/0413/06-window-rename-chain.md`、R4 `prompts/0413/02-terminal-signal-fusion.md`
> 证据: Image #5

---

## 一、用户原话（情绪与诉求都清晰）

> **"我多次始终要求的功能依旧完全没有实现"**
>
> 1. AI 窗口要可以自命名，通知"任务完成时"要带上窗口名称
> 2. 感测还是太愚钝太无效，经常出现误报、瞎报、错报
> 3. "分组"和"布局"功能不可用
> 4. 监控进度功能做得依然不够好，迟报、漏报、错误后依然报
> 5. 窗口能进行的功能太少

此外 Image #5 还暴露一个显性 Bug：
- 窗口名过长（如 `claude-prompt-e981529c-f955-49e5-aba3-d919296c82da.md - Notepad`）导致卡片布局溢出
- 窗口列表没有滚动条，无法上下查看全部窗口（页眉显示 "9 窗口" 但视口只看到 4 张卡片）

---

## 二、五大痛点详细记录

### §1 AI 窗口自命名 + 通知标识【第 5 次反馈】

**用户工作流**：
同时开启多个 AI CLI 实例（Claude Code × N、Codex CLI、OpenCode、Gemini CLI 等），每个实例跑不同任务。任务完成时若通知只显示 `[AI 工具完成]` 或泛泛的 `claude-code.exe`，用户**完全不知道是哪个实例完成了哪个任务**。

**需求**（已在 R1 PRD §2.1 提出）：
- [ ] 每个 AI 窗口支持**用户自定义别名**（如 "Claude-前端重构" / "Codex-API开发"）
- [ ] 别名持久化存储（应用重启后保留）
- [ ] 通知文案格式：`[别名] 任务完成`，点击通知聚焦该窗口
- [ ] 窗口列表里优先显示别名（原窗口名作为次要信息）

**为什么四轮未实现**：
- R4 code review 已识别 `window:rename` IPC channel **完全缺失**（`prompts/0413/06-window-rename-chain.md`）
- 方案已写但**未被实施**
- 落地阻塞：需要后端 IPC 通道 + `AIAliasManager.ts`（已有文件 6.9KB，但前端订阅链不完整）+ 前端 store + 通知服务修改

**下一步**：直接启用 `prompts/0413/06-window-rename-chain.md` 的方案落地。

### §2 分组 + 布局【第 5 次反馈】

**Image #5** 顶部显示：
```
│ 窗口 9 │ 分组 0 │ 布局 0 │
```

**用户原话**：「目前的"分组"和"布局"功能不可用，比较奇怪」

**需求**（已在 R1 PRD §2.2 提出）：
- [ ] 分组：按类型（AI 工具 / 文本编辑器 / 终端 / 浏览器）或自定义标签
- [ ] 布局：Tile（平铺）/ Cascade（层叠）/ Master-Slave / 自定义布局保存

**为什么四轮未实现**：
- R4 已有方案 `prompts/0413/` I1: "windowStore.ts 缺少内置布局预设 (Tile/Cascade/Master-Slave)"——列为"小项直接实施"
- I6: `saveLayoutOnExit` 未实现
- 疑似状态：方案已列，代码未写完整

**下一步**：启用 R4 I1 + I6 落地 + 补 UI 触发入口。

### §3 AI 任务感测准确性【第 5 次反馈】

**用户原话**：「**误报、瞎报、错报**」 + 「**迟报、漏报、错误后依然报**」

**需求**：
- [ ] 完成状态检测置信度必须可量化（false positive / false negative 都要降）
- [ ] 错误发生后不应继续"完成"误报
- [ ] 进度变化有清晰的时间线

**为什么四轮未实现**：
- R4 `prompts/0413/02-terminal-signal-fusion.md` 指出："AI 任务感测缺终端输出速率、提示符检测、子进程退出信号"——大项，需设计文档讨论
- R4 `prompts/0413/07-aitask-confidence-state.md` 指出 confidence / indicators 未暴露到前端
- 方案已成形但未实施

**下一步**：**必须**把 `02-terminal-signal-fusion.md` 从"待讨论"升级到"可实施"并执行。

### §4 监控进度迟报 / 漏报 / 错误后继续报

同 §3 同根同源。

### §5 窗口能进行的功能太少

**当前窗口卡片的可用操作**（猜测基于截图）：
- 聚焦 / 显示
- 最小化 / 还原

**用户期望**（推测）：
- 结束进程（通过 owner PID）
- 置顶 / 取消置顶
- 截图 / 录屏（针对 AI 任务进度截取）
- 自动排列（配合 §2）
- 发送命令 / 注入输入（如自动发送 Continue 给 Claude Code CLI）
- 关联项目（把窗口挂靠到"工程控制台"的某个项目下）

**下一步**：需与用户进一步 brainstorm 确认优先功能清单。

### §6 【新增 R5 显性 Bug】窗口卡片溢出 + 无滚动

- 窗口名过长（`claude-prompt-e981529c-...-d919296c82da.md - Notepad`）→ 卡片溢出
- 列表无滚动条
- 修复方向：
  - 标题 `truncate` + `title` 属性显示完整
  - 容器加 `overflow-y: auto` + 虚拟滚动

---

## 三、关联代码

- `src/main/services/WindowManager.ts`（37KB，核心逻辑）
- `src/main/services/AIAliasManager.ts`（6.9KB，已存在）
- `src/main/services/AITaskTracker.ts`（39KB，核心感测）
- `src/main/services/ToolMonitor.ts`（15KB）
- `src/main/services/NotificationService.ts`（9KB）
- `src/renderer/stores/windowStore.ts`
- `src/renderer/stores/aiTaskStore.ts`
- 前序方案（直接启用）：
  - `prompts/0413/02-terminal-signal-fusion.md`
  - `prompts/0413/06-window-rename-chain.md`
  - `prompts/0413/07-aitask-confidence-state.md`
  - `prompts/0411/03-window-management-spec.md`

探索指令：
```
gitnexus_impact({target:"WindowManager", direction:"both"})
gitnexus_impact({target:"AITaskTracker", direction:"both"})
serena.find_symbol(name_path_pattern:"AIAliasManager", depth:2, include_body:true)
serena.find_referencing_symbols(
  name_path:"renameWindow",  # R4 指出该 IPC 缺失，先确认
  relative_path:"devhub/src"
)
```

---

## 四、验收标准

- §1 AI 窗口可命名 + 通知携带名称，用户能从通知直接认出是哪个实例
- §2 分组 / 布局按钮点了**有反应**，且 Tile / Cascade / Master-Slave 真实可用
- §3 AI 感测连续 30 分钟运行，误报 ≤ 1 次 / 漏报 ≤ 1 次
- §4 同 §3
- §5 窗口卡片右键菜单至少 8 个实用动作（具体清单待 brainstorm）
- §6 卡片布局不溢出，列表可滚动

---

## 五、优先级说明

即便 N1 (资源爆炸) 不修，§1/§2/§3 也可以独立推进。但 **§3 的感测准确性测试必须在 N1 修复后再验收**——否则 PowerShell 失败会污染测量结果。
